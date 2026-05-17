import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DB_URL = Deno.env.get('EDIKTED_DB_URL');

let _pgClient = null;
async function getPgClient() {
  if (_pgClient) return _pgClient;
  const pg = await import('npm:pg@8.11.3');
  const Client = pg.default?.Client || pg.Client;
  _pgClient = new Client({ connectionString: DB_URL, ssl: false });
  await _pgClient.connect();
  return _pgClient;
}

async function query(sql, params = []) {
  const client = await getPgClient();
  const res = await client.query(sql, params);
  return res.rows;
}

const REASON_TO_RESPONSIBILITY = {
  'Force Majeure': 'OTHER',
  'DD Temporary': 'OTHER',
  'PPS Approval Late': 'EDIKTED',
  'Fabric Approval Late': 'EDIKTED',
  'QC Approval Late': 'EDIKTED',
  'Wrong Packing Materials': 'EDIKTED',
  'Labels Arrive Late': 'EDIKTED',
  'QC Reproduction': 'SUPPLIER',
  'QC ReWork': 'SUPPLIER',
  'PPS Submission Late': 'SUPPLIER',
  'Fabric Issue': 'SUPPLIER',
  'Production Capacity Issue': 'SUPPLIER',
  'Technical problem - washing': 'SUPPLIER',
  'Technical problem - printing': 'SUPPLIER',
  'Technical problem - sewing / handmade': 'SUPPLIER',
  'Packing Issue': 'SUPPLIER',
  'Special details late': 'SUPPLIER',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { dd_employee_id } = body;

    // sub_po_view has most enriched data; join suppliers/po_types/style_colors for name resolution
    const poSql = `
      SELECT
        spv.po_number,
        spv.order_date,
        spv.due_date,
        spv.dd_status,
        spv.delayed_due_date,
        spv.next_update,
        spv.urgent,
        spv.delivery_date_status,
        spv.style_color,
        spv.dd_manager,
        spv.collection,
        spv.ordered_qty,
        spv.qty_received,
        spv.balance,
        spv.good_for_sale,
        spv.qty_sent_out,
        spv.delivery_date,
        spv.drop,
        sup.supplier AS supplier_name,
        pt.type AS po_type_name,
        sc.product_image
      FROM sub_po_view spv
      LEFT JOIN purchase_orders po ON po.po_number = spv.po_number
      LEFT JOIN suppliers sup ON sup.id = po.supplier
      LEFT JOIN po_types pt ON pt.id = po.po_type
      LEFT JOIN style_colors sc ON sc.style_color = spv.style_color
      WHERE spv.due_date >= NOW() - INTERVAL '60 days'
        AND spv.due_date <= NOW() + INTERVAL '180 days'
      ORDER BY spv.due_date ASC
      LIMIT 500
    `;

    let pos = [];
    try {
      pos = await query(poSql);
    } catch (dbErr) {
      console.error('DB error:', dbErr.message);
      return Response.json({ error: 'Database error: ' + dbErr.message }, { status: 500 });
    }

    // Resolve dd_manager integer IDs -> name/email from edikted_employees
    const managerIds = [...new Set(pos.map(p => p.dd_manager).filter(Boolean))];
    let managerMap = {};
    if (managerIds.length > 0) {
      const managers = await query(
        `SELECT id, name, email FROM edikted_employees WHERE id = ANY($1::int[])`,
        [managerIds]
      );
      for (const m of managers) managerMap[m.id] = m;
    }

    // Fetch Base44 overrides
    const overrides = await base44.entities.po_overrides.list();
    const overrideMap = {};
    for (const ov of overrides) {
      overrideMap[ov.po_number] = ov;
    }

    // Fetch all dd_updates for KPI + row enrichment
    const allUpdates = await base44.entities.dd_updates.list('-created_date', 2000);

    // Group updates by po_number
    const updatesByPo = {};
    for (const upd of allUpdates) {
      if (!updatesByPo[upd.po_number]) updatesByPo[upd.po_number] = [];
      updatesByPo[upd.po_number].push(upd);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows = pos.map(po => {
      const ov = overrideMap[po.po_number] || {};
      const poUpdates = updatesByPo[po.po_number] || [];
      const mgr = managerMap[po.dd_manager] || null;

      // Effective fields (Base44 overrides take precedence)
      const effectiveDelayedDD = ov.delayed_due_date || po.delayed_due_date || null;
      const effectiveDdStatus = ov.dd_status || po.dd_status || null;
      const effectiveNextUpdate = ov.next_update_date || po.next_update || null;
      const finalDD = effectiveDelayedDD || po.due_date;

      // Latest DDD_UPDATE
      const dddUpdates = poUpdates.filter(u => u.type === 'DDD_UPDATE').sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      const latestDDD = dddUpdates[0] || null;

      // Latest GENERAL_UPDATE
      const generalUpdates = poUpdates.filter(u => u.type === 'GENERAL_UPDATE').sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

      // DD Comment log (general comments history)
      const ddCommentLog = generalUpdates
        .filter(u => u.general_comment)
        .map(u => ({
          date: u.created_date,
          text: u.general_comment === 'Other' ? (u.general_comment_other_text || '') : u.general_comment,
          id: u.id,
        }));

      // Computed fields
      const dueDate = po.due_date ? new Date(po.due_date) : null;
      const delayedDate = effectiveDelayedDD ? new Date(effectiveDelayedDD) : null;
      const finalDate = new Date(finalDD);

      const daysLateCounting = dueDate && delayedDate
        ? Math.round((delayedDate - dueDate) / 86400000)
        : 0;

      const countdown = Math.round((finalDate - today) / 86400000);
      const dddCount = dddUpdates.length;

      // HOLD Age
      let holdAgeDays = null;
      if (latestDDD && latestDDD.status === 'HOLD') {
        holdAgeDays = Math.floor((today - new Date(latestDDD.created_date)) / 86400000);
      }

      // Days same status
      let daysSameStatus = null;
      if (ov.dd_status_changed_at) {
        daysSameStatus = Math.floor((today - new Date(ov.dd_status_changed_at)) / 86400000);
      }

      // Priority
      let priority = 'Normal';
      if (po.urgent) {
        priority = 'URGENT';
      } else if (daysLateCounting > 3) {
        priority = 'Deadline';
      }

      // Late/Future
      const lateFuture = finalDate < today ? 'LATE' : 'FUTURE';

      // Flags
      const nextUpdatePassed = effectiveNextUpdate && new Date(effectiveNextUpdate) < today;
      const qtyError = po.good_for_sale === 0 && po.qty_sent_out > 0;

      return {
        po_number: po.po_number,
        style_color: po.style_color || '',
        order_date: po.order_date,
        due_date: po.due_date,
        ordered_qty: po.ordered_qty,
        qty_received: po.qty_received,
        balance: po.balance,
        good_for_sale: po.good_for_sale,
        qty_sent_out: po.qty_sent_out,
        delivery_date: po.delivery_date,
        delivery_date_status: po.delivery_date_status || '',
        dd_manager_id: po.dd_manager,
        dd_manager_name: mgr?.name || String(po.dd_manager || ''),
        dd_manager_email: mgr?.email || '',
        supplier: po.supplier_name || String(po.supplier || ''),
        po_type: po.po_type_name || String(po.po_type || ''),
        collection: po.collection || '',
        product_image: po.product_image || '',
        urgent: !!po.urgent,
        drop: po.drop,
        // Effective/computed
        effective_delayed_due_date: effectiveDelayedDD,
        effective_dd_status: effectiveDdStatus,
        effective_next_update: effectiveNextUpdate,
        final_dd: finalDD,
        days_late_counting: daysLateCounting,
        countdown,
        priority,
        late_future: lateFuture,
        ddd_count: dddCount,
        hold_age_days: holdAgeDays,
        days_same_status: daysSameStatus,
        flags: po.urgent ? 'URGENT' : (qtyError || nextUpdatePassed ? 'REVIEW' : ''),
        // Latest DDD info
        current_status: latestDDD ? latestDDD.status : null,
        ddd_reason: latestDDD ? latestDDD.reason : null,
        ddd_comment: latestDDD ? latestDDD.ddd_comment : null,
        delay_response_comment: latestDDD ? latestDDD.delay_response_comment : null,
        internal_note: latestDDD ? latestDDD.internal_note : null,
        last_ddd_update_id: latestDDD ? latestDDD.id : null,
        // General comment history
        dd_comment_log: ddCommentLog,
        has_override: !!ov.po_number,
      };
    });

    // If DD employee, filter to their assigned POs
    let filteredRows = rows;
    if (dd_employee_id) {
      filteredRows = rows.filter(r => r.dd_manager_id === dd_employee_id || r.dd_manager_email === user.email);
    }

    // KPI counts
    const todayStr = today.toISOString().slice(0, 10);
    const allDddUpdates = allUpdates.filter(u => u.type === 'DDD_UPDATE');
    const kpis = {
      new_pending: allDddUpdates.filter(u => u.status === 'HOLD' && u.created_date?.slice(0, 10) === todayStr).length,
      total_pending: allDddUpdates.filter(u => u.status === 'HOLD').length,
      urgent_pending: allDddUpdates.filter(u => u.status === 'HOLD' && filteredRows.find(r => r.po_number === u.po_number && r.urgent)).length,
      approved_today: allDddUpdates.filter(u => u.status === 'APPROVED' && u.decision_at?.slice(0, 10) === todayStr).length,
      rejected_today: allDddUpdates.filter(u => u.status === 'REJECTED' && u.decision_at?.slice(0, 10) === todayStr).length,
      acknowledged_today: allDddUpdates.filter(u => u.status === 'ACKNOWLEDGED' && u.decision_at?.slice(0, 10) === todayStr).length,
    };

    return Response.json({ rows: filteredRows, kpis });
  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
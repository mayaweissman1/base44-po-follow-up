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

    // Check more columns
    const moreCheck = await query(`
      SELECT table_name, column_name, data_type FROM information_schema.columns
      WHERE table_schema='public' 
      AND ((table_name='purchase_orders' AND column_name IN ('dd_status','urgent','drop','good_for_sale','qty_sent_out','balance','pm_tags','qty_rw_manual','qty_rw_auto','goods_received','qty_received','ordered_qty','po_number'))
      OR (table_name='sub_po_view'))
      ORDER BY table_name, column_name
    `);
    console.log('More cols:', JSON.stringify(moreCheck));
    return Response.json({ more: moreCheck });

    // Fetch POs from Edikted DB — all FK joins use integer IDs
    // Note: column names from actual schema (e.g. delivary_date_status with typo)
    const poSql = `
      SELECT
        po.po_number,
        po.order_date,
        po.due_date,
        po.dd_status,
        po.delayed_due_date,
        po.next_update,
        po.urgent,
        po.delivary_date_status AS delivery_date_status,
        po.po_type AS po_type_id,
        po.dd_manager AS dd_manager_id,
        po.supplier AS supplier_id,
        po.urgent,
        sc.product_image,
        sc.style_color AS style_color_code,
        sc.published,
        emp.name AS dd_manager_name,
        emp.email AS dd_manager_email,
        sup.supplier AS supplier_name,
        pt.type AS po_type_name,
        col.collection AS collection_name,
        spv.ordered_qty,
        spv.qty_received,
        spv.qty_rw_manual,
        spv.qty_rw_auto,
        spv.goods_received,
        spv.good_for_sale,
        spv.qty_sent_out,
        spv.balance,
        spv.pm_tags,
        spv.drop
      FROM purchase_orders po
      LEFT JOIN style_colors sc ON sc.id = po.style_color
      LEFT JOIN suppliers sup ON sup.id = po.supplier
      LEFT JOIN edikted_employees emp ON emp.id = po.dd_manager
      LEFT JOIN po_types pt ON pt.id = po.po_type
      LEFT JOIN collections col ON col.id = sc.collection
      LEFT JOIN LATERAL (
        SELECT
          SUM(spv2.ordered_qty) AS ordered_qty,
          SUM(spv2.qty_received) AS qty_received,
          NULL::integer AS qty_rw_manual,
          NULL::integer AS qty_rw_auto,
          NULL::date AS goods_received,
          NULL::integer AS good_for_sale,
          NULL::integer AS qty_sent_out,
          SUM(spv2.balance) AS balance,
          NULL::text AS pm_tags,
          NULL::date AS drop
        FROM sub_po_view spv2
        WHERE spv2.po_number = po.po_number
        LIMIT 1
      ) spv ON true
      WHERE po.due_date >= NOW() - INTERVAL '60 days'
        AND po.due_date <= NOW() + INTERVAL '180 days'
      ORDER BY po.due_date ASC
      LIMIT 500
    `;

    let pos = [];
    try {
      pos = await query(poSql);
    } catch (dbErr) {
      console.error('DB error:', dbErr.message);
      return Response.json({ error: 'Database error: ' + dbErr.message }, { status: 500 });
    }

    // Fetch Base44 overrides
    const overrides = await base44.entities.po_overrides.list();
    const overrideMap = {};
    for (const ov of overrides) {
      overrideMap[ov.po_number] = ov;
    }

    // Fetch latest dd_updates for each PO
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

      // Effective fields (COALESCE override over source)
      const effectiveDelayedDD = ov.delayed_due_date || po.delayed_due_date || null;
      const effectiveDdStatus = ov.dd_status || po.dd_status || null;
      const effectiveNextUpdate = ov.next_update_date || po.next_update || null;
      const styleColor = po.style_color_code || '';
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
        const createdAt = new Date(latestDDD.created_date);
        holdAgeDays = Math.floor((today - createdAt) / 86400000);
      }

      // Days same status
      let daysSameStatus = null;
      if (ov.dd_status_changed_at) {
        daysSameStatus = Math.floor((today - new Date(ov.dd_status_changed_at)) / 86400000);
      }

      // Priority
      let priority = null;
      if (po.urgent) {
        priority = 'URGENT';
      } else if (daysLateCounting > 3) {
        priority = 'Deadline at risk / Accumulated delay';
      } else {
        priority = 'Normal';
      }

      // Late/Future
      let lateFuture = null;
      if (finalDate < today) {
        lateFuture = 'LATE';
      } else {
        lateFuture = 'FUTURE';
      }

      // Flags
      const qtyError = (po.good_for_sale === 0 || po.good_for_sale === '0') && 
                       po.qty_sent_out > 0;
      const nextUpdatePassed = effectiveNextUpdate && new Date(effectiveNextUpdate) < today;

      return {
        po_number: po.po_number,
        style_color: styleColor,
        order_date: po.order_date,
        due_date: po.due_date,
        ordered_qty: po.ordered_qty,
        qty_received: po.qty_received,
        qty_rw_manual: po.qty_rw_manual,
        qty_rw_auto: po.qty_rw_auto,
        goods_received: po.goods_received,
        dd_manager_id: po.dd_manager_id,
        dd_manager_name: po.dd_manager_name || String(po.dd_manager_id || ''),
        dd_manager_email: po.dd_manager_email || '',
        supplier: po.supplier_name || String(po.supplier_id || ''),
        po_type: po.po_type_name || '',
        collection: po.collection_name || '',
        product_image: po.product_image || '',
        pm_tags: po.pm_tags || '',
        urgent: !!po.urgent,
        drop: po.drop,
        balance: po.balance,
        good_for_sale: po.good_for_sale,
        qty_sent_out: po.qty_sent_out,
        delivery_date_status: po.delivery_date_status || '',
        published: po.published,
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
        flags: po.urgent ? 'URGENT' : (qtyError ? 'REVIEW' : (nextUpdatePassed ? 'REVIEW' : '')),
        // Latest DDD info
        current_status: latestDDD ? latestDDD.status : null,
        ddd_reason: latestDDD ? latestDDD.reason : null,
        ddd_comment: latestDDD ? latestDDD.ddd_comment : null,
        delay_response_comment: latestDDD ? latestDDD.delay_response_comment : null,
        internal_note: latestDDD ? latestDDD.internal_note : null,
        last_ddd_update_id: latestDDD ? latestDDD.id : null,
        // General comment history
        dd_comment_log: ddCommentLog,
        // Override IDs for write operations
        has_override: !!ov.po_number,
      };
    });

    // If DD employee, filter to their employee id
    let filteredRows = rows;
    if (dd_employee_id) {
      filteredRows = rows.filter(r => r.dd_manager_id === dd_employee_id || r.dd_manager_email === user.email);
    }

    // Compute KPI counts from Base44 data
    const todayStart = today.toISOString();
    const allDddUpdates = allUpdates.filter(u => u.type === 'DDD_UPDATE');
    const kpis = {
      new_pending: allDddUpdates.filter(u => u.status === 'HOLD' && u.created_date >= todayStart.slice(0, 10)).length,
      total_pending: allDddUpdates.filter(u => u.status === 'HOLD').length,
      urgent_pending: allDddUpdates.filter(u => u.status === 'HOLD' && filteredRows.find(r => r.po_number === u.po_number && r.urgent)).length,
      approved_today: allDddUpdates.filter(u => u.status === 'APPROVED' && u.decision_at && u.decision_at.startsWith(todayStart.slice(0, 10))).length,
      rejected_today: allDddUpdates.filter(u => u.status === 'REJECTED' && u.decision_at && u.decision_at.startsWith(todayStart.slice(0, 10))).length,
      acknowledged_today: allDddUpdates.filter(u => u.status === 'ACKNOWLEDGED' && u.decision_at && u.decision_at.startsWith(todayStart.slice(0, 10))).length,
    };

    return Response.json({ rows: filteredRows, kpis });
  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
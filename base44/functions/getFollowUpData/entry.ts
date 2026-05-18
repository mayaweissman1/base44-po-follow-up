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

    // Fetch Base44 overrides + dd_updates IN PARALLEL
    const [overrides, allUpdates] = await Promise.all([
      base44.entities.po_overrides.list(),
      base44.entities.dd_updates.list('-created_date', 2000),
    ]);

    const overrideMap = {};
    for (const ov of overrides) overrideMap[ov.po_number] = ov;

    // Bucket updates by PO and by type in a single pass.
    // Since allUpdates is already sorted desc by created_date, first hit per (po, type) is the latest.
    const dddByPo = {};       // latest DDD_UPDATE per PO
    const generalByPo = {};   // ALL GENERAL_UPDATEs per PO (desc order preserved)
    const dddCountByPo = {};  // total DDD_UPDATE count per PO
    for (const u of allUpdates) {
      if (u.type === 'DDD_UPDATE') {
        if (!dddByPo[u.po_number]) dddByPo[u.po_number] = u;
        dddCountByPo[u.po_number] = (dddCountByPo[u.po_number] || 0) + 1;
      } else if (u.type === 'GENERAL_UPDATE') {
        if (!generalByPo[u.po_number]) generalByPo[u.po_number] = [];
        generalByPo[u.po_number].push(u);
      }
    }

    // Always include POs that have base44 activity (overrides or updates),
    // even if their due_date is outside the default window
    const activeSet = new Set([
      ...Object.keys(overrideMap),
      ...Object.keys(dddByPo),
      ...Object.keys(generalByPo),
    ]);
    const activePoNumbers = [...activeSet];

    // Fetch ALL sub_po rows (one per destination) for sub-PO expansion
    // Resolve destination name via shipment_destination table
    // Prioritize active POs (those with overrides/updates) so they're never cut off by LIMIT.
    // Order: active POs first, then by due_date so the most relevant window rows come before older ones.
    const subPoSql = `
      WITH ranked AS (
        SELECT
          pov.*,
          rank() OVER (
            PARTITION BY pov.destination, pov.style_color
            ORDER BY COALESCE(pov.delayed_due_date, pov.due_date), pov.order_date, pov.sub_po_number
          ) AS po_rank
        FROM sub_po_view pov
      )
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
        spv.destination AS destination_id,
        spv.po_rank,
        sd.destination AS destination_name,
        sup.supplier AS supplier_name,
        pt.type AS po_type_name,
        sc.product_image,
        (spv.po_number = ANY($1::text[]))::int AS is_active
      FROM ranked spv
      LEFT JOIN purchase_orders po ON po.po_number = spv.po_number
      LEFT JOIN suppliers sup ON sup.id = po.supplier
      LEFT JOIN po_types pt ON pt.id = po.po_type
      LEFT JOIN style_colors sc ON sc.style_color = spv.style_color
      LEFT JOIN shipment_destination sd ON sd.id = spv.destination
      WHERE (
              (spv.due_date >= NOW() - INTERVAL '60 days'
               AND spv.due_date <= NOW() + INTERVAL '180 days')
              OR spv.po_number = ANY($1::text[])
            )
      ORDER BY is_active DESC, spv.due_date ASC, spv.po_number ASC, spv.destination ASC
      LIMIT 5000
    `;

    let subPosRaw = [];
    try {
      subPosRaw = await query(subPoSql, [activePoNumbers]);
    } catch (dbErr) {
      console.error('DB error:', dbErr.message);
      return Response.json({ error: 'Database error: ' + dbErr.message }, { status: 500 });
    }

    // Group sub-POs by po_number to get unique POs + sub_pos list
    const poMap = new Map();
    for (const row of subPosRaw) {
      if (!poMap.has(row.po_number)) {
        poMap.set(row.po_number, { ...row, sub_pos: [], po_rank_min: row.po_rank ?? null });
      }
      const parent = poMap.get(row.po_number);
      // Track best (lowest) rank across destinations for the PO-level value
      if (row.po_rank != null && (parent.po_rank_min == null || row.po_rank < parent.po_rank_min)) {
        parent.po_rank_min = row.po_rank;
      }
      // Add sub-PO entry — use destination name (resolved via shipment_destination) when available
      parent.sub_pos.push({
        destination: row.destination_name || (row.destination_id != null ? `#${row.destination_id}` : '—'),
        ordered_qty: row.ordered_qty,
        qty_received: row.qty_received,
        po_rank: row.po_rank ?? null,
        priority: null, // will be filled in later
      });
    }

    const pos = [...poMap.values()];

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows = pos.map(po => {
      const ov = overrideMap[po.po_number] || {};
      const mgr = managerMap[po.dd_manager] || null;

      // Effective fields (Base44 overrides take precedence)
      const effectiveDelayedDD = ov.delayed_due_date || po.delayed_due_date || null;
      const effectiveDdStatus = ov.dd_status || po.dd_status || null;
      const effectiveNextUpdate = ov.next_update_date || po.next_update || null;
      const finalDD = effectiveDelayedDD || po.due_date;

      // Latest DDD_UPDATE (precomputed)
      const latestDDD = dddByPo[po.po_number] || null;
      const dddCount = dddCountByPo[po.po_number] || 0;

      // DD Comment log (general comments history, already desc-sorted)
      const generalUpdates = generalByPo[po.po_number] || [];
      const ddCommentLog = [];
      for (const u of generalUpdates) {
        if (u.general_comment) {
          ddCommentLog.push({
            date: u.created_date,
            text: u.general_comment === 'Other' ? (u.general_comment_other_text || '') : u.general_comment,
            id: u.id,
          });
        }
      }

      // Computed fields
      const dueDate = po.due_date ? new Date(po.due_date) : null;
      const delayedDate = effectiveDelayedDD ? new Date(effectiveDelayedDD) : null;
      const finalDate = new Date(finalDD);

      const daysLateCounting = dueDate && delayedDate
        ? Math.round((delayedDate - dueDate) / 86400000)
        : 0;

      const countdown = Math.round((finalDate - today) / 86400000);

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

      // Sub-POs with priority filled in
      const subPos = (po.sub_pos || []).map(s => ({ ...s, priority }));

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
        po_rank: po.po_rank_min ?? null,
        product_image: po.product_image || '',
        urgent: !!po.urgent,
        drop: po.drop,
        destination: po.destination_name || (po.destination_id != null ? String(po.destination_id) : ''),
        sub_pos: subPos,
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

    // KPI counts — single pass over latest-DDD-per-PO (precomputed in dddByPo)
    const todayStr = today.toISOString().slice(0, 10);
    const urgentPoSet = new Set(filteredRows.filter(r => r.urgent).map(r => r.po_number));
    const kpis = { new_pending: 0, total_pending: 0, urgent_pending: 0, approved_today: 0, rejected_today: 0, acknowledged_today: 0 };
    for (const u of Object.values(dddByPo)) {
      const decidedToday = u.decision_at?.slice(0, 10) === todayStr;
      const createdToday = u.created_date?.slice(0, 10) === todayStr;
      if (u.status === 'HOLD') {
        kpis.total_pending++;
        if (createdToday) kpis.new_pending++;
        if (urgentPoSet.has(u.po_number)) kpis.urgent_pending++;
      } else if (decidedToday) {
        if (u.status === 'APPROVED') kpis.approved_today++;
        else if (u.status === 'REJECTED') kpis.rejected_today++;
        else if (u.status === 'ACKNOWLEDGED') kpis.acknowledged_today++;
      }
    }

    return Response.json({ rows: filteredRows, kpis });
  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
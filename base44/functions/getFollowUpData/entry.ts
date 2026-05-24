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

// Match legacy cutting: po_status = 3 (Open) AND done = false.
const PO_STATUS_INCLUDE = [3];

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
    const dddByPo = {};
    const generalByPo = {};
    const dddCountByPo = {};
    for (const u of allUpdates) {
      if (u.type === 'DDD_UPDATE') {
        if (!dddByPo[u.po_number]) dddByPo[u.po_number] = u;
        dddCountByPo[u.po_number] = (dddCountByPo[u.po_number] || 0) + 1;
      } else if (u.type === 'GENERAL_UPDATE') {
        if (!generalByPo[u.po_number]) generalByPo[u.po_number] = [];
        generalByPo[u.po_number].push(u);
      }
    }

    // Always include POs that have base44 activity even if outside the default window
    const activeSet = new Set([
      ...Object.keys(overrideMap),
      ...Object.keys(dddByPo),
      ...Object.keys(generalByPo),
    ]);
    const activePoNumbers = [...activeSet];

    // PRIMARY QUERY — po_view, one row per PO.
    // Matches current project semantics: po_status IN (3,5), done=false.
    // Date window: ±60d / +180d, OR PO has base44 activity.
    const poSql = `
      WITH manual_rw_per_po AS (
        SELECT spv.po_number, SUM(COALESCE(bl.rw, 0)) AS manual_rw
        FROM batch_lines bl
        JOIN batch_details bd ON bd.id = bl.batch_id
        JOIN sub_po_view spv ON spv.sub_po_number = bd.sub_po_number
        WHERE bl.rw IS NOT NULL AND bl.rw > 0
        GROUP BY spv.po_number
      ),
      destinations_per_po AS (
        SELECT spv.po_number, ARRAY_AGG(DISTINCT sd.destination) FILTER (WHERE sd.destination IS NOT NULL) AS destinations
        FROM sub_po_view spv
        LEFT JOIN shipment_destination sd ON sd.id = spv.destination
        GROUP BY spv.po_number
      ),
      sub_po_ranks AS (
        SELECT
          spv.po_number,
          spv.sub_po_number,
          RANK() OVER (
            PARTITION BY spv.destination, spv.style_color
            ORDER BY COALESCE(spv.delayed_due_date, spv.due_date), spv.order_date, spv.sub_po_number
          ) AS sub_rank
        FROM sub_po_view spv
      ),
      po_rank_per_po AS (
        SELECT po_number, MIN(sub_rank)::int AS po_rank
        FROM sub_po_ranks
        GROUP BY po_number
      )
      SELECT
        pov.po_number,
        pov.po_status,
        pov.done,
        pov.style_color,
        pov.order_date,
        pov.due_date,
        pov.delayed_due_date,
        pov.dd_status,
        pov.delivery_date_status,
        pov.next_update,
        pov.urgent,
        pov.drop,
        pov.dd_manager,
        pov.ordered_qty,
        pov.qty_received,
        pov.balance,
        pov.good_for_sale,
        pov.qty_sent_out,
        pov.qty_otw_air,
        pov.qty_rw_manual,
        pov.qty_rw_auto,
        pov.goods_received,
        pov.delivery_date,
        pov.pm_tags,
        sup.supplier AS supplier_name,
        pt.type AS po_type_name,
        c.collection AS collection_name,
        mrw.manual_rw AS manual_rw_calc,
        dpo.destinations,
        prk.po_rank,
        sds.bulk_fabric_approval,
        pps.receipt_date AS pps_receipt_date,
        pmt.tag AS pm_tag_label
      FROM po_view pov
      LEFT JOIN suppliers sup ON sup.id = pov.supplier
      LEFT JOIN po_types pt ON pt.id = pov.po_type
      LEFT JOIN style_colors_view scv ON scv.style_color = pov.style_color
      LEFT JOIN collections c ON c.id = scv.collection
      LEFT JOIN style_colors sc ON sc.id = scv.id
      LEFT JOIN style_dev_suppliers sds ON sds.id = sc.style_dev_supplier
      LEFT JOIN style_color_pps pps ON pps.style_color = scv.id
      LEFT JOIN pm_tags pmt ON pmt.id = pov.pm_tags
      LEFT JOIN manual_rw_per_po mrw ON mrw.po_number = pov.po_number
      LEFT JOIN destinations_per_po dpo ON dpo.po_number = pov.po_number
      LEFT JOIN po_rank_per_po prk ON prk.po_number = pov.po_number
      WHERE pov.po_status = ANY($1::int[])
        AND pov.done = false
      ORDER BY pov.due_date ASC NULLS LAST, pov.po_number ASC
    `;

    let pos = [];
    try {
      pos = await query(poSql, [PO_STATUS_INCLUDE]);
    } catch (dbErr) {
      console.error('DB error:', dbErr.message);
      return Response.json({ error: 'Database error: ' + dbErr.message }, { status: 500 });
    }

    // Resolve dd_manager IDs -> name/email
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

      const effectiveDelayedDD = ov.delayed_due_date || po.delayed_due_date || null;
      const effectiveDdStatus = ov.dd_status || po.dd_status || null;
      const effectiveNextUpdate = ov.next_update_date || po.next_update || null;
      const finalDD = effectiveDelayedDD || po.due_date;

      const latestDDD = dddByPo[po.po_number] || null;
      const dddCount = dddCountByPo[po.po_number] || 0;

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

      const dueDate = po.due_date ? new Date(po.due_date) : null;
      const delayedDate = effectiveDelayedDD ? new Date(effectiveDelayedDD) : null;
      const finalDate = new Date(finalDD);

      const daysLateCounting = dueDate && delayedDate
        ? Math.round((delayedDate - dueDate) / 86400000)
        : 0;

      const countdown = Math.round((finalDate - today) / 86400000);

      let holdAgeDays = null;
      if (latestDDD && latestDDD.status === 'HOLD') {
        holdAgeDays = Math.floor((today - new Date(latestDDD.created_date)) / 86400000);
      }

      let daysSameStatus = null;
      if (ov.dd_status_changed_at) {
        daysSameStatus = Math.floor((today - new Date(ov.dd_status_changed_at)) / 86400000);
      }

      // Fully-received check: qty_received >= ordered_qty means the goods arrived,
      // so we should not flag the PO as LATE even if past its due date.
      // (done=true POs are already excluded by the SQL WHERE clause.)
      const ordered = Number(po.ordered_qty) || 0;
      const received = Number(po.qty_received) || 0;
      const fullyReceived = ordered > 0 && received >= ordered;

      let priority = 'Normal';
      if (po.urgent) priority = 'URGENT';
      else if (daysLateCounting > 3) priority = 'Deadline';

      const lateFuture = fullyReceived
        ? 'RECEIVED'
        : (finalDate < today ? 'LATE' : 'FUTURE');

      const nextUpdatePassed = effectiveNextUpdate && new Date(effectiveNextUpdate) < today;
      const qtyError = po.good_for_sale === 0 && po.qty_sent_out > 0;

      // Build a thin sub_pos list with destinations only (no qty — used for chips/labels)
      const destinations = Array.isArray(po.destinations) ? po.destinations : [];
      const subPos = destinations.map(d => ({ destination: d, priority }));

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
        goods_received: po.goods_received,
        done: !!po.done,
        dd_manager_id: po.dd_manager,
        dd_manager_name: mgr?.name || String(po.dd_manager || ''),
        dd_manager_email: mgr?.email || '',
        supplier: po.supplier_name || String(po.supplier || ''),
        po_type: po.po_type_name || '',
        collection: po.collection_name || '',
        urgent: !!po.urgent,
        drop: po.drop,
        destination: destinations.join(' · '),
        sub_pos: subPos,
        pm_tags: po.pm_tags,
        pm_tags_label: po.pm_tag_label || null,
        pps_receipt_date: po.pps_receipt_date,
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
        // Latest DDD info — `reason` may be string (legacy) or array (new). Normalize for the UI.
        current_status: latestDDD ? latestDDD.status : null,
        ddd_reason: latestDDD
          ? (Array.isArray(latestDDD.reason) ? (latestDDD.reason[0] || null) : latestDDD.reason)
          : null,
        ddd_reasons: latestDDD
          ? (Array.isArray(latestDDD.reason) ? latestDDD.reason : (latestDDD.reason ? [latestDDD.reason] : []))
          : [],
        ddd_reason_other_text: latestDDD ? latestDDD.reason_other_text : null,
        ddd_comment: latestDDD ? latestDDD.ddd_comment : null,
        delay_response_comment: latestDDD ? latestDDD.delay_response_comment : null,
        internal_note: latestDDD ? latestDDD.internal_note : null,
        last_ddd_update_id: latestDDD ? latestDDD.id : null,
        dd_comment_log: ddCommentLog,
        has_override: !!ov.po_number,
        // Numerics from po_view (no aggregation needed)
        po_rank: po.po_rank != null ? Number(po.po_rank) : null,
        air_otw: Number(po.qty_otw_air) || 0,
        manual_rw: Number(po.qty_rw_manual ?? po.manual_rw_calc) || 0,
        auto_rw: Number(po.qty_rw_auto) || 0,
        bulk_fabric_approval: po.bulk_fabric_approval ?? null,
        shipped_percent: (Number(po.ordered_qty) > 0)
          ? Math.round((Number(po.qty_sent_out) || 0) / Number(po.ordered_qty) * 100)
          : null,
      };
    });

    // If DD employee, filter to their assigned POs
    let filteredRows = rows;
    if (dd_employee_id) {
      filteredRows = rows.filter(r => r.dd_manager_id === dd_employee_id || r.dd_manager_email === user.email);
    }

    // KPI counts
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
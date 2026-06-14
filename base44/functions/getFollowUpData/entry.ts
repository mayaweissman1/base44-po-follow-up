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

// Dedupe urgent_priority — strips US-/UK- prefixes and removes duplicates.
// "US-O WITH CLOSE DROP DATE,UK-O WITH CLOSE DROP DATE" → "O WITH CLOSE DROP DATE"
function dedupePriority(raw) {
  if (!raw) return null;
  const parts = String(raw).split(/[,;|]+/);
  const seen = new Set();
  const out = [];
  for (const p of parts) {
    const stripped = p.trim().replace(/^(US|UK)\s*[-–:]\s*/i, '').trim();
    if (stripped && !seen.has(stripped)) {
      seen.add(stripped);
      out.push(stripped);
    }
  }
  return out.length > 0 ? out.join(', ') : null;
}

// "Needs your attention" — mirrors the urgents_view WHERE conditions.
// Uses fields fetched by the main SQL query (not urb_ aliases from urgent_orders_base_mv).
// Called only for POs where po.urgent = false and ov.marked_urgent = false.
function computeNeedsAttention(po) {
  const poTypePrefix = (po.po_type_prefix || '').trim();
  const isWrRSwimr = ['WR', 'R', 'SWIMR'].includes(poTypePrefix);
  const isOSwim    = ['O', 'SWIM'].includes(poTypePrefix);
  const scInd      = po.inv_days != null ? Number(po.inv_days) : null;

  if (po.pu_tag === true) return true;
  if (po.urgent_tagged === true) return true;
  // "URGENT BEFORE CNY" tag in pm_tags
  if (po.pm_tag_label && /urgent before cny/i.test(po.pm_tag_label)) return true;
  if (isWrRSwimr && scInd != null && scInd <= 30) return true;
  if (isOSwim) return true;
  // collection_type_id = 18 with O or R orders
  if (po.collection_type_id === 18 && ['O', 'R'].includes(poTypePrefix)) return true;
  return false;
}

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

    // Check if optional table urgent_reasons_base exists — it's not present in all environments.
    let hasUrgentReasonsBase = false;
    try {
      const checkRes = await query(`SELECT to_regclass('public.urgent_reasons_base') AS r`);
      hasUrgentReasonsBase = !!checkRes[0]?.r;
    } catch {
      hasUrgentReasonsBase = false;
    }

    const urgentPriorityCte = hasUrgentReasonsBase ? `
      urgent_priority_per_po AS (
        SELECT DISTINCT ON (urb.po_number) urb.po_number,
          CASE
            WHEN urb.po_type = ANY (ARRAY['WR','R','SWIMR'])
                 AND urb.open_quantity >= 1000::numeric
                 AND urb.published >= (CURRENT_DATE - INTERVAL '45 days')
                 AND urb.sc_ind <= 15::numeric              THEN 'BEST SELLER NEW'
            WHEN urb.po_type = ANY (ARRAY['WR','R','SWIMR'])
                 AND urb.open_quantity >= 1500::numeric
                 AND urb.all_sales > 10000::numeric
                 AND urb.sc_ind <= 15::numeric              THEN 'BEST SELLER OLD'
            WHEN urb.po_type = ANY (ARRAY['WR','R','SWIMR'])
                 AND urb.sku_min_ind <= 5::numeric          THEN
              CASE WHEN urb.sku_max_ind <= 5::numeric THEN 'SOLD OUT'
                   ELSE 'MISSING SIZES' END
            WHEN urb.pu_tag = true                          THEN 'MANUAL'
            WHEN urb.urgent_tagged = true                   THEN urb.sc_pm_tags
            WHEN urb.po_type = ANY (ARRAY['WR','R','SWIMR']) THEN 'URGENT'
            WHEN urb.po_type = ANY (ARRAY['O','SWIM'])      THEN
              concat('Drop',
                CASE WHEN urb.special_collection IS NULL THEN ' '
                     ELSE concat(' ', urb.special_collection, ' ') END,
                urb.drop_date)
            WHEN urb.days_in_risk_status > 5                THEN 'Risk in Fabric/PPS'
            ELSE NULL
          END AS urgent_priority
        FROM urgent_reasons_base urb
        ORDER BY urb.po_number
      )` : `
      urgent_priority_per_po AS (
        SELECT NULL::text AS po_number, NULL::text AS urgent_priority WHERE FALSE
      )`;

    // PRIMARY QUERY — po_view, one row per PO.
    // Matches current project semantics: po_status IN (3,5), done=false.
    // Date window: ±60d / +180d, OR PO has base44 activity.
    const poSql = `
      WITH bs_flag AS (
        SELECT DISTINCT pus.po_number
        FROM po_urgent_status pus
        WHERE pus.reason ILIKE '%Best Seller%'
      ),
      urgency_reason_per_po AS (
        SELECT po_number, string_agg(reason, ',' ORDER BY reason) AS urgency_reason
        FROM (SELECT DISTINCT po_number, reason FROM po_urgent_status WHERE reason IS NOT NULL AND reason <> '') _r
        GROUP BY po_number
      ),
      pu_tag_id AS (
        SELECT id FROM pm_tags WHERE pm_tag = 'PU' LIMIT 1
      ),
      urgent_tagged_styles AS (
        SELECT DISTINCT sc_inner.style_color
        FROM style_colors sc_inner
        WHERE EXISTS (
          SELECT 1 FROM pm_tags pmt_inner
          WHERE pmt_inner.id = ANY(sc_inner.pm_tags)
          AND pmt_inner.pm_tag ILIKE 'urgent-%'
        )
      ),
      sub_bno_per_po AS (
        SELECT
          spv.po_number,
          MAX(CASE WHEN sd.destination = 'Edikted'
                   AND (COALESCE(spv.balance,0) - COALESCE(spv.qty_otw,0)) > 3000
                   AND COALESCE(spv.qty_otw,0) < 0.5 * COALESCE(spv.balance,0)
                   THEN 1 ELSE 0 END) AS us_flag,
          MAX(CASE WHEN sd.destination = 'EdiktedUK'
                   AND (COALESCE(spv.balance,0) - COALESCE(spv.qty_otw,0)) > 1000
                   AND COALESCE(spv.qty_otw,0) < 0.5 * COALESCE(spv.balance,0)
                   THEN 1 ELSE 0 END) AS uk_flag
        FROM sub_po_view spv
        LEFT JOIN shipment_destination sd ON sd.id = spv.destination
        GROUP BY spv.po_number
      ),
      shipping_methods_per_po AS (
        SELECT spv.po_number,
               ARRAY_AGG(DISTINCT NULLIF(spv.shipping_method::text,'')) FILTER (WHERE spv.shipping_method IS NOT NULL) AS shipping_methods,
               ARRAY_AGG(DISTINCT sm.method) FILTER (WHERE sm.method IS NOT NULL) AS shipping_method_names
        FROM sub_po_view spv
        LEFT JOIN shipment_methods sm ON sm.id = spv.shipping_method
        GROUP BY spv.po_number
      ),
      dest_priority_per_po AS (
        SELECT
          spv.po_number,
          MAX(CASE WHEN sd.destination IN ('Edikted')   AND pus.reason ILIKE '%best seller%' THEN 3
                   WHEN sd.destination IN ('Edikted')   AND (spv.urgent = true OR pus.reason ILIKE '%urgent%') THEN 2
                   WHEN sd.destination IN ('Edikted')   THEN 1
                   ELSE 0 END) AS us_priority,
          MAX(CASE WHEN sd.destination IN ('EdiktedUK') AND pus.reason ILIKE '%best seller%' THEN 3
                   WHEN sd.destination IN ('EdiktedUK') AND (spv.urgent = true OR pus.reason ILIKE '%urgent%') THEN 2
                   WHEN sd.destination IN ('EdiktedUK') THEN 1
                   ELSE 0 END) AS uk_priority
        FROM sub_po_view spv
        LEFT JOIN shipment_destination sd ON sd.id = spv.destination
        LEFT JOIN po_urgent_status pus    ON pus.po_number = spv.po_number
        GROUP BY spv.po_number
      ),
      manual_rw_per_po AS (
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
      ),
      inv_per_style AS (
        SELECT "Style Color" AS style_color,
               MIN("Inv Days") AS inv_days
        FROM edktd_history.repeats_sc_united_history
        WHERE "Inv Days" IS NOT NULL
        GROUP BY "Style Color"
      ),
      missing_per_style AS (
        SELECT "Style Color" AS style_color,
               ARRAY_AGG(DISTINCT trim(s)) FILTER (WHERE trim(s) <> '') AS missing_sizes
        FROM dbt_marts.mart_repeats__sc_united_with_groups,
             LATERAL regexp_split_to_table(COALESCE("Missing Sizes",''), '[,;|/]+') AS s
        WHERE "Missing Sizes" IS NOT NULL AND "Missing Sizes" <> ''
        GROUP BY "Style Color"
      ),
      ${urgentPriorityCte}
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
        pmt.tag AS pm_tag_label,
        scv.product_image AS product_image,
        scv.published AS sc_published,
        CASE WHEN bs.po_number IS NOT NULL THEN true ELSE false END AS is_best_seller,
        urp.urgency_reason AS urgency_reason,
        COALESCE(sbn.us_flag, 0) AS bno_us_flag,
        COALESCE(sbn.uk_flag, 0) AS bno_uk_flag,
        smp.shipping_methods AS shipping_methods,
        smp.shipping_method_names AS shipping_method_names,
        ips.inv_days AS inv_days,
        mps.missing_sizes AS missing_sizes,
        dpp.us_priority AS us_priority_raw,
        dpp.uk_priority AS uk_priority_raw,
        upp.urgent_priority AS urgent_priority,
        TRIM(BOTH FROM pt.prefix) AS po_type_prefix,
        CASE WHEN (SELECT id FROM pu_tag_id) = ANY(sc.pm_tags) THEN true ELSE false END AS pu_tag,
        CASE WHEN uts.style_color IS NOT NULL THEN true ELSE false END AS urgent_tagged,
        c.collection_type_id AS collection_type_id
      FROM po_view pov
      LEFT JOIN suppliers sup ON sup.id = pov.supplier
      LEFT JOIN po_types pt ON pt.id = pov.po_type
      LEFT JOIN style_colors_view scv ON scv.style_color = pov.style_color
      LEFT JOIN collections c ON c.id = scv.collection
      LEFT JOIN style_colors sc ON sc.id = scv.id
      LEFT JOIN style_dev_suppliers sds ON sds.id = sc.style_dev_supplier
      LEFT JOIN style_color_pps pps ON pps.style_color = scv.id
      LEFT JOIN LATERAL (
        SELECT string_agg(pmt.pm_tag, ', ' ORDER BY pmt.pm_tag) AS tag
        FROM pm_tags pmt
        WHERE pmt.id = ANY(pov.pm_tags)
      ) pmt ON true
      LEFT JOIN manual_rw_per_po mrw ON mrw.po_number = pov.po_number
      LEFT JOIN destinations_per_po dpo ON dpo.po_number = pov.po_number
      LEFT JOIN po_rank_per_po prk ON prk.po_number = pov.po_number
      LEFT JOIN bs_flag bs ON bs.po_number = pov.po_number
      LEFT JOIN urgency_reason_per_po urp ON urp.po_number = pov.po_number
      LEFT JOIN sub_bno_per_po sbn ON sbn.po_number = pov.po_number
      LEFT JOIN shipping_methods_per_po smp ON smp.po_number = pov.po_number
      LEFT JOIN dest_priority_per_po dpp ON dpp.po_number = pov.po_number
      LEFT JOIN inv_per_style ips ON ips.style_color = pov.style_color
      LEFT JOIN missing_per_style mps ON mps.style_color = pov.style_color
      LEFT JOIN urgent_priority_per_po upp ON upp.po_number = pov.po_number
      LEFT JOIN urgent_tagged_styles uts ON uts.style_color = pov.style_color
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

      // Priority label: prefer the explicit urgency reason (e.g. "Best Seller New")
      // when present; otherwise fall back to URGENT/Deadline/Normal.
      // Dedupe US-/UK- prefixes — same rule as urgent_priority / urgency_reason_raw.
      let priority = 'Normal';
      if (po.urgency_reason) priority = dedupePriority(po.urgency_reason) || 'Normal';
      else if (po.urgent) priority = 'URGENT';
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
        product_image: po.product_image || null,
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
        is_best_seller: !!po.is_best_seller,
        bno_high_low_otw: (Number(po.bno_us_flag) || 0) + (Number(po.bno_uk_flag) || 0) > 0,
        shipping_methods: Array.isArray(po.shipping_methods) ? po.shipping_methods : [],
        shipping_method_names: Array.isArray(po.shipping_method_names) ? po.shipping_method_names : [],
        inv_days: po.inv_days != null ? Math.round(Number(po.inv_days)) : null,
        missing_sizes: Array.isArray(po.missing_sizes) ? po.missing_sizes : [],
        // Raw urgency reason from po_urgent_status — the most accurate priority signal.
        // Dedupe + strip US-/UK- destination prefixes (PO-level value, not per-dest).
        urgency_reason_raw: dedupePriority(po.urgency_reason),
        // Per-destination priority (US = Edikted, UK = EdiktedUK).
        // Maps 0=None / 1=Normal / 2=Urgent / 3=Best Seller
        us_priority: po.us_priority_raw ? (po.us_priority_raw === 3 ? 'BEST_SELLER' : po.us_priority_raw === 2 ? 'URGENT' : 'NORMAL') : null,
        uk_priority: po.uk_priority_raw ? (po.uk_priority_raw === 3 ? 'BEST_SELLER' : po.uk_priority_raw === 2 ? 'URGENT' : 'NORMAL') : null,
        // Computed urgent priority (per spec §3.3.2). Main Office "Mark as Urgent"
        // override forces this to 'MANUAL' regardless of the SQL computation.
        // Strip US-/UK- destination prefixes and dedupe — the column is PO-level,
        // so "US-O WITH CLOSE DROP DATE,UK-O WITH CLOSE DROP DATE" collapses to one.
        urgent_priority: ov.marked_urgent
          ? 'MANUAL'
          : dedupePriority(po.urgent_priority),
        marked_urgent: !!ov.marked_urgent,
        marked_urgent_reason: ov.marked_urgent_reason || null,
        // "Needs your attention" — true when the PO is not already urgent/marked
        // but matches the urgents_view entry conditions (mirrors SQL WHERE logic).
        needs_attention: !po.urgent && !ov.marked_urgent && computeNeedsAttention(po),
        // PU tag — computed from style_color.pm_tags matching the 'PU' pm_tag id.
        pu_tag: po.pu_tag === true,
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
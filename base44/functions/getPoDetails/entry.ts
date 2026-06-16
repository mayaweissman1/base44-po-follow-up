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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { po_number } = body;
    if (!po_number) return Response.json({ error: 'po_number is required' }, { status: 400 });

    const client = await getPgClient();

    // All five queries run in parallel. Optional tables (sku_sizes_invd, the
    // repeats mart) may not exist in every environment — wrap their queries
    // so a missing table doesn't break Air OTW / sub-PO listing for everyone.
    const safe = (p) => p.catch(err => {
      console.warn('getPoDetails optional query failed:', err.message);
      return { rows: [] };
    });
    const [sizeIndRes, subRes, urgRes, indRes, airOtwRes, shipmentsRes, sizeBreakdownRes] = await Promise.all([
      // Per-size inventory-days (XS / S / M / XS-S) per destination, from
      // sku_sizes_invd. Joined by destination CODE + style_color (per spec).
      // Gated to Rep orders — the table mirrors the repeats mart.
      safe(client.query(`
        SELECT
          sd.destination AS destination_name,
          sd.code        AS dest_code,
          ssi.size       AS size_name,
          ssi.inv_days   AS inv_days
        FROM sub_po_view po
        JOIN shipment_destination sd ON sd.id = po.destination
        JOIN po_view pv              ON pv.po_number = po.po_number
        JOIN po_types pt             ON pt.id = pv.po_type
        JOIN sku_sizes_invd ssi
          ON ssi.destination = sd.code
         AND ssi.style_color = po.style_color
         AND ssi.size = ANY(ARRAY['XS','S','M','XS/S'])
        WHERE po.po_number = $1
          AND TRIM(BOTH FROM pt.prefix) = ANY(ARRAY['WR','R','SWIMR'])
      `, [po_number])),

      // Sub-POs with destination, urgency, shipping method
      // (Air OTW is taken from pl_po+shipments in the airOtwRes query — all order types)
      client.query(`
        SELECT
          spv.sub_po_number,
          sd.destination AS destination_name,
          sd.code        AS dest_code,
          spv.urgent     AS sub_urgent,
          sm.method      AS shipping_method_name
        FROM sub_po_view spv
        LEFT JOIN shipment_destination sd ON sd.id = spv.destination
        LEFT JOIN shipment_methods sm     ON sm.id = spv.shipping_method
        WHERE spv.po_number = $1
      `, [po_number]),

      // Urgency reason (Best Seller / URGENT) per PO — applies to all destinations
      client.query(`SELECT reason FROM po_urgent_status WHERE po_number = $1 LIMIT 1`, [po_number]),

      // IND per destination (Rep-only, sourced from the repeats mart).
      // Air OTW is now computed separately for ALL order types (see airOtwRes).
      safe(client.query(`
        SELECT DISTINCT
          rep."Destination" AS dest_code,
          rep."Inv Days"    AS inv_days
        FROM sub_po_view po
        JOIN shipment_destination sd ON sd.id = po.destination
        JOIN po_view pv              ON pv.po_number = po.po_number
        JOIN po_types pt             ON pt.id = pv.po_type
        JOIN dbt_marts.mart_repeats__sc_united_with_groups rep
          ON rep."Destination" = sd.code
         AND rep."Style Color" = po.style_color
        WHERE po.po_number = $1
          AND TRIM(BOTH FROM pt.prefix) = ANY(ARRAY['WR','R','SWIMR'])
      `, [po_number])),

      // Air OTW per destination — works for ALL order types.
      // Mirrors the getAirOtwShipments query but aggregates per (style_color, destination)
      // for every sub-PO destination on this PO.
      client.query(`
        SELECT
          sd.code AS dest_code,
          SUM(pl_po.quantity) AS air_otw
        FROM sub_po_view spo
        JOIN style_colors sc          ON sc.style_color = spo.style_color
        JOIN skus s                   ON s.style_color = sc.id
        JOIN pl_po                    ON pl_po.sku = s.sku
        JOIN shipments ship           ON pl_po.shipment_id = ship.id
        JOIN shipment_statuses st     ON ship.status = st.id
        JOIN shipment_destination sd  ON sd.id = ship.destination
        WHERE spo.po_number = $1
          AND upper(st.status) = 'ON THE WAY'
          AND ship.method <> 2
          AND sd.id = spo.destination
        GROUP BY sd.code
      `, [po_number]),

      // Earliest open shipment per destination — used by the PO drawer's
      // "Shipment Details" section to surface departure/arrival/method.
      // Picks the shipment with the earliest est_arrival_date so the user sees
      // the next inbound batch per destination.
      safe(client.query(`
        WITH ranked AS (
          SELECT
            sd.code         AS dest_code,
            ship.shipment_number,
            ship.departure_date,
            ship.departure_date + smd.est_transition_days AS est_arrival_date,
            sm.method       AS shipping_method,
            SUM(pl_po.quantity) AS quantity,
            ROW_NUMBER() OVER (
              PARTITION BY sd.code
              ORDER BY (ship.departure_date + smd.est_transition_days) ASC NULLS LAST, ship.shipment_number
            ) AS rn
          FROM sub_po_view spo
          JOIN style_colors sc          ON sc.style_color = spo.style_color
          JOIN skus s                   ON s.style_color = sc.id
          JOIN pl_po                    ON pl_po.sku = s.sku
          JOIN shipments ship           ON pl_po.shipment_id = ship.id
          JOIN shipment_statuses st     ON ship.status = st.id
          JOIN shipment_destination sd  ON sd.id = ship.destination
          JOIN shipment_method_destinations smd
            ON ship.method = smd.shipment_method AND ship.destination = smd.destination
          JOIN shipment_methods sm      ON sm.id = ship.method
          WHERE spo.po_number = $1
            AND upper(st.status) = 'ON THE WAY'
            AND ship.method <> 2
            AND sd.id = spo.destination
          GROUP BY sd.code, ship.shipment_number, ship.departure_date, smd.est_transition_days, sm.method
        )
        SELECT * FROM ranked WHERE rn = 1
      `, [po_number])),

      // Per-(destination, size) ordered / received — drives the size breakdown
      // table inside the PO drawer's "Shipment Details" section. Open quantity =
      // ordered − received (clamped to 0).
      safe(client.query(`
        SELECT
          sd.destination AS destination_name,
          sd.code        AS dest_code,
          sz.size        AS size_name,
          SUM(COALESCE(spq.ordered_qty, 0))  AS ordered_qty,
          SUM(COALESCE(spq.qty_received, 0)) AS qty_received
        FROM sub_po_view spv
        JOIN shipment_destination sd ON sd.id = spv.destination
        LEFT JOIN sub_po_qty spq     ON spq.sub_po_number = spv.sub_po_number
        LEFT JOIN sizes sz           ON sz.id = spq.size
        WHERE spv.po_number = $1
          AND sz.size IS NOT NULL
        GROUP BY sd.destination, sd.code, sz.size
      `, [po_number])),
    ]);

    const destBySubPo = {};
    for (const r of subRes.rows) {
      destBySubPo[r.sub_po_number] = r.destination_name || '—';
    }

    const isBestSeller = urgRes.rows[0]?.reason?.toLowerCase().includes('best seller') || false;
    const isUrgent     = urgRes.rows[0]?.reason?.toLowerCase().includes('urgent') || false;

    // Per-destination IND (Rep-only, from repeats mart) + Air OTW (all order types, from pl_po+shipments)
    const indByDest = {};
    const airOtwByDest = {};
    for (const r of indRes.rows) {
      if (r.inv_days != null) indByDest[r.dest_code] = Math.round(Number(r.inv_days));
    }
    for (const r of airOtwRes.rows) {
      if (r.air_otw != null) airOtwByDest[r.dest_code] = Number(r.air_otw) || 0;
    }

    // Per-size inventory-days by destination from sku_sizes_invd.
    // sizes_by_size[size] = inv_days for that (destination, size) pair.
    const byDest = {};
    for (const r of sizeIndRes.rows) {
      const dest = r.destination_name || '—';
      if (!byDest[dest]) {
        byDest[dest] = {
          destination: dest,
          sub_po_numbers: new Set(),
          sizes_by_size: {},
          shipping_methods_set: new Set(),
          sub_urgent: false,
        };
      }
      const sz = (r.size_name || '').toUpperCase();
      if (sz && r.inv_days != null) {
        byDest[dest].sizes_by_size[sz] = Math.round(Number(r.inv_days));
      }
    }

    // Layer in sub-PO-level fields (shipping methods, urgent flag).
    // Air OTW now comes from the repeats mart, not sub_po_view.
    const destCodeMap = {}; // raw destination name -> sd.code (US/UK/…)
    for (const r of subRes.rows) {
      const dest = r.destination_name || '—';
      if (!byDest[dest]) {
        byDest[dest] = {
          destination: dest,
          sub_po_numbers: new Set(),
          sizes: [],
          sizes_by_size: {},
          shipping_methods_set: new Set(),
          sub_urgent: false,
        };
      }
      byDest[dest].sub_po_numbers.add(r.sub_po_number);
      if (r.shipping_method_name) byDest[dest].shipping_methods_set.add(r.shipping_method_name);
      if (r.sub_urgent) byDest[dest].sub_urgent = true;
      if (r.dest_code) destCodeMap[dest] = r.dest_code;
    }

    // Map raw destination name → mart lookup key (sd.code, e.g. 'US'/'UK')
    function codeForDest(name) {
      if (destCodeMap[name]) return destCodeMap[name];
      const n = String(name || '').toLowerCase();
      if (n === 'edikteduk') return 'UK';
      if (n === 'edikted')   return 'US';
      return null;
    }

    // Earliest open shipment per destination — used by the drawer's
    // "Shipment Details" section.
    const safeIso = (v) => {
      if (!v) return null;
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d.toISOString();
    };
    const shipmentByCode = {};
    for (const r of shipmentsRes.rows) {
      shipmentByCode[r.dest_code] = {
        shipment_number: r.shipment_number,
        departure_date: safeIso(r.departure_date),
        est_arrival_date: safeIso(r.est_arrival_date),
        shipping_method: r.shipping_method,
        quantity: Number(r.quantity) || 0,
      };
    }

    // Per-(destination, size) ordered/received → grouped by destination CODE.
    // Each entry: { size, ordered, received }. UI merges with IND from sizes_by_size.
    const sizeBreakdownByCode = {};
    for (const r of sizeBreakdownRes.rows) {
      const code = r.dest_code;
      if (!code) continue;
      if (!sizeBreakdownByCode[code]) sizeBreakdownByCode[code] = [];
      sizeBreakdownByCode[code].push({
        size: r.size_name,
        ordered: Number(r.ordered_qty) || 0,
        received: Number(r.qty_received) || 0,
      });
    }

    const destinations = Object.values(byDest).map(d => {
      const priority = isBestSeller ? 'BEST_SELLER' : (isUrgent || d.sub_urgent ? 'URGENT' : 'NORMAL');
      const code = codeForDest(d.destination);
      return {
        destination: d.destination,
        sub_po_numbers: [...d.sub_po_numbers],
        sizes_by_size: d.sizes_by_size,
        air_otw: code != null ? (airOtwByDest[code] ?? null) : null,
        shipping_method_names: [...d.shipping_methods_set],
        inv_days: code != null ? (indByDest[code] ?? null) : null,
        priority,
        // Shipment details for the PO drawer's "Shipment Details" section.
        next_shipment: code != null ? (shipmentByCode[code] || null) : null,
        size_breakdown: code != null ? (sizeBreakdownByCode[code] || []) : [],
      };
    });

    return Response.json({ po_number, destinations });
  } catch (e) {
    console.error('Error in getPoDetails:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});
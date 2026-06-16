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

    // All four queries run in parallel. The IND lookup uses a subquery on
    // po_view so we don't have to wait for styleColor — saves 1 round trip.
    const [skuRes, subRes, urgRes, indRes] = await Promise.all([
      // Per-SKU breakdown joined with size names via skus + sizes
      client.query(`
        SELECT
          pv.sub_po_number,
          pv.sku,
          pv.ordered_qty,
          pv.qty_received,
          pv.good_for_sale,
          pv.balance,
          s.size  AS size_name,
          s.sort_order
        FROM pod_view pv
        LEFT JOIN skus sk ON sk.sku = pv.sku
        LEFT JOIN sizes s ON s.id = sk.size
        WHERE pv.po_number = $1
        ORDER BY pv.sub_po_number, s.sort_order NULLS LAST, pv.sku
      `, [po_number]),

      // Sub-POs with destination, urgency, shipping method
      // (Air OTW is taken from the mart in the next query — repeats only)
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

      // IND + Air OTW per destination — Rep orders only.
      // Source: dbt_marts.mart_repeats__sc_united_with_groups joined to
      // sub_po_view by destination code AND style_color (per spec).
      // The mart is repeats-only — gate by po_type prefix so new/SWIM
      // orders don't get fake values.
      client.query(`
        SELECT DISTINCT
          rep."Destination" AS dest_code,
          rep."Inv Days"    AS inv_days,
          rep."Air OTW"     AS air_otw
        FROM sub_po_view po
        JOIN shipment_destination sd ON sd.id = po.destination
        JOIN po_view pv              ON pv.po_number = po.po_number
        JOIN po_types pt             ON pt.id = pv.po_type
        JOIN dbt_marts.mart_repeats__sc_united_with_groups rep
          ON rep."Destination" = sd.code
         AND rep."Style Color" = po.style_color
        WHERE po.po_number = $1
          AND TRIM(BOTH FROM pt.prefix) = ANY(ARRAY['WR','R','SWIMR'])
      `, [po_number]),
    ]);

    const destBySubPo = {};
    for (const r of subRes.rows) {
      destBySubPo[r.sub_po_number] = r.destination_name || '—';
    }

    const isBestSeller = urgRes.rows[0]?.reason?.toLowerCase().includes('best seller') || false;
    const isUrgent     = urgRes.rows[0]?.reason?.toLowerCase().includes('urgent') || false;

    // Per-destination IND + Air OTW from the repeats mart (keyed by sd.code → US/UK)
    const indByDest = {};
    const airOtwByDest = {};
    for (const r of indRes.rows) {
      if (r.inv_days != null) indByDest[r.dest_code] = Math.round(Number(r.inv_days));
      if (r.air_otw  != null) airOtwByDest[r.dest_code] = Number(r.air_otw) || 0;
    }

    // Group sizes by destination → { sizes_by_size: { XS: 30, S: 60, … } }
    const byDest = {};
    for (const r of skuRes.rows) {
      const subPo = r.sub_po_number;
      const dest = destBySubPo[subPo] || '—';
      if (!byDest[dest]) {
        byDest[dest] = {
          destination: dest,
          sub_po_numbers: new Set(),
          sizes: [],              // legacy per-SKU list (kept for backward compat)
          sizes_by_size: {},      // new: { sizeName -> total ordered qty }
          air_otw: 0,
          shipping_methods_set: new Set(),
          sub_urgent: false,
        };
      }
      byDest[dest].sub_po_numbers.add(subPo);
      byDest[dest].sizes.push({
        sku: r.sku,
        size: r.size_name || '—',
        ordered_qty: Number(r.ordered_qty) || 0,
        qty_received: Number(r.qty_received) || 0,
        good_for_sale: Number(r.good_for_sale) || 0,
        balance: Number(r.balance) || 0,
      });
      const sz = (r.size_name || '').toUpperCase();
      if (sz) {
        byDest[dest].sizes_by_size[sz] = (byDest[dest].sizes_by_size[sz] || 0) + (Number(r.ordered_qty) || 0);
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

    const destinations = Object.values(byDest).map(d => {
      const priority = isBestSeller ? 'BEST_SELLER' : (isUrgent || d.sub_urgent ? 'URGENT' : 'NORMAL');
      const code = codeForDest(d.destination);
      return {
        destination: d.destination,
        sub_po_numbers: [...d.sub_po_numbers],
        sizes: d.sizes,
        sizes_by_size: d.sizes_by_size,
        air_otw: code != null ? (airOtwByDest[code] ?? null) : null,
        shipping_method_names: [...d.shipping_methods_set],
        inv_days: code != null ? (indByDest[code] ?? null) : null,
        priority,
      };
    });

    return Response.json({ po_number, destinations });
  } catch (e) {
    console.error('Error in getPoDetails:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});
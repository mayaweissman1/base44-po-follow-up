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

      // Sub-POs with destination, urgency, shipping method, air OTW
      client.query(`
        SELECT
          spv.sub_po_number,
          sd.destination AS destination_name,
          spv.urgent     AS sub_urgent,
          spv.qty_otw_air,
          sm.method      AS shipping_method_name
        FROM sub_po_view spv
        LEFT JOIN shipment_destination sd ON sd.id = spv.destination
        LEFT JOIN shipment_methods sm     ON sm.id = spv.shipping_method
        WHERE spv.po_number = $1
      `, [po_number]),

      // Urgency reason (Best Seller / URGENT) per PO — applies to all destinations
      client.query(`SELECT reason FROM po_urgent_status WHERE po_number = $1 LIMIT 1`, [po_number]),

      // IND per destination — joined via po_view in one round trip.
      // Uses the current dbt mart snapshot (history table contains stale 0-rows).
      client.query(`
        SELECT m."Destination" AS dest_code, m."Inv Days" AS inv_days
        FROM dbt_marts.mart_repeats__sc_united_with_groups m
        JOIN po_view pv ON pv.style_color = m."Style Color"
        WHERE pv.po_number = $1 AND m."Inv Days" IS NOT NULL
      `, [po_number]),
    ]);

    const destBySubPo = {};
    for (const r of subRes.rows) {
      destBySubPo[r.sub_po_number] = r.destination_name || '—';
    }

    const isBestSeller = urgRes.rows[0]?.reason?.toLowerCase().includes('best seller') || false;
    const isUrgent     = urgRes.rows[0]?.reason?.toLowerCase().includes('urgent') || false;

    const indByDest = {};
    for (const r of indRes.rows) {
      indByDest[r.dest_code] = r.inv_days == null ? null : Math.round(Number(r.inv_days));
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

    // Layer in sub-PO-level fields (air OTW, shipping methods, urgent flag)
    for (const r of subRes.rows) {
      const dest = r.destination_name || '—';
      if (!byDest[dest]) {
        byDest[dest] = {
          destination: dest,
          sub_po_numbers: new Set(),
          sizes: [],
          sizes_by_size: {},
          air_otw: 0,
          shipping_methods_set: new Set(),
          sub_urgent: false,
        };
      }
      byDest[dest].sub_po_numbers.add(r.sub_po_number);
      byDest[dest].air_otw += Number(r.qty_otw_air) || 0;
      if (r.shipping_method_name) byDest[dest].shipping_methods_set.add(r.shipping_method_name);
      if (r.sub_urgent) byDest[dest].sub_urgent = true;
    }

    // Map raw destination name → IND lookup key (Edikted → US, EdiktedUK → UK)
    function indForDest(name) {
      const n = String(name || '').toLowerCase();
      if (n === 'edikteduk') return indByDest['UK'] ?? null;
      if (n === 'edikted')   return indByDest['US'] ?? null;
      return null;
    }

    const destinations = Object.values(byDest).map(d => {
      const priority = isBestSeller ? 'BEST_SELLER' : (isUrgent || d.sub_urgent ? 'URGENT' : 'NORMAL');
      return {
        destination: d.destination,
        sub_po_numbers: [...d.sub_po_numbers],
        sizes: d.sizes,
        sizes_by_size: d.sizes_by_size,
        air_otw: d.air_otw,
        shipping_method_names: [...d.shipping_methods_set],
        inv_days: indForDest(d.destination),
        priority,
      };
    });

    return Response.json({ po_number, destinations });
  } catch (e) {
    console.error('Error in getPoDetails:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});
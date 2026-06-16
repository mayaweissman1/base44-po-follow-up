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
    const [sizeIndRes, subRes, urgRes, indRes] = await Promise.all([
      // Per-size inventory-days (XS / S / M / XS-S) per destination, from
      // sku_sizes_invd. Joined by destination CODE + style_color (per spec).
      // Gated to Rep orders — the table mirrors the repeats mart.
      client.query(`
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
      };
    });

    return Response.json({ po_number, destinations });
  } catch (e) {
    console.error('Error in getPoDetails:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});
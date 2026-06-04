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

    // Per-SKU breakdown joined with size names via skus + sizes
    const skuRes = await client.query(`
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
    `, [po_number]);

    // Destinations per sub-PO (so we can group by destination + size)
    const subRes = await client.query(`
      SELECT
        spv.sub_po_number,
        sd.destination AS destination_name,
        spv.urgent     AS sub_urgent
      FROM sub_po_view spv
      LEFT JOIN shipment_destination sd ON sd.id = spv.destination
      WHERE spv.po_number = $1
    `, [po_number]);

    const destBySubPo = {};
    const urgentBySubPo = {};
    for (const r of subRes.rows) {
      destBySubPo[r.sub_po_number] = r.destination_name || '—';
      urgentBySubPo[r.sub_po_number] = !!r.sub_urgent;
    }

    // Urgency reason (Best Seller / URGENT) per PO — applies to all destinations
    const urgRes = await client.query(`
      SELECT reason FROM po_urgent_status WHERE po_number = $1 LIMIT 1
    `, [po_number]);
    const isBestSeller = urgRes.rows[0]?.reason?.toLowerCase().includes('best seller') || false;
    const isUrgent = urgRes.rows[0]?.reason?.toLowerCase().includes('urgent') || false;

    // Per-destination priority
    const priorityByDest = {};
    for (const r of subRes.rows) {
      const dest = r.destination_name || '—';
      const p = isBestSeller ? 'BEST_SELLER' : (isUrgent || r.sub_urgent ? 'URGENT' : 'NORMAL');
      // Worst-case wins (Best Seller > URGENT > NORMAL)
      const rank = { BEST_SELLER: 3, URGENT: 2, NORMAL: 1 };
      if (!priorityByDest[dest] || rank[p] > rank[priorityByDest[dest]]) {
        priorityByDest[dest] = p;
      }
    }

    // Group by destination, with array of size rows
    const byDest = {};
    for (const r of skuRes.rows) {
      const dest = destBySubPo[r.sub_po_number] || '—';
      if (!byDest[dest]) byDest[dest] = [];
      byDest[dest].push({
        sku: r.sku,
        size: r.size_name || '—',
        ordered_qty: Number(r.ordered_qty) || 0,
        qty_received: Number(r.qty_received) || 0,
        good_for_sale: Number(r.good_for_sale) || 0,
        balance: Number(r.balance) || 0,
      });
    }

    const destinations = Object.entries(byDest).map(([destination, sizes]) => ({
      destination,
      sizes,
      priority: priorityByDest[destination] || null,
    }));

    return Response.json({ po_number, destinations });
  } catch (e) {
    console.error('Error in getPoDetails:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});
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

// Minimal duplicate of getFollowUpData just for R0105498-CL inspection
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const overrides = await base44.entities.po_overrides.list();
    const overrideMap = {};
    for (const ov of overrides) overrideMap[ov.po_number] = ov;
    const allUpdates = await base44.entities.dd_updates.list('-created_date', 2000);
    const updatesByPo = {};
    for (const upd of allUpdates) {
      if (!updatesByPo[upd.po_number]) updatesByPo[upd.po_number] = [];
      updatesByPo[upd.po_number].push(upd);
    }
    const activePoNumbers = [...new Set([...Object.keys(overrideMap), ...Object.keys(updatesByPo)])];

    const client = await getPgClient();
    const sql = `
      SELECT spv.po_number, spv.destination AS destination_id, sd.destination AS destination_name,
             spv.due_date, spv.ordered_qty, spv.qty_received
      FROM sub_po_view spv
      LEFT JOIN shipment_destination sd ON sd.id = spv.destination
      WHERE (
              (spv.due_date >= NOW() - INTERVAL '60 days' AND spv.due_date <= NOW() + INTERVAL '180 days')
              OR spv.po_number = ANY($1::text[])
            )
      ORDER BY spv.po_number, spv.destination
    `;
    const r = await client.query(sql, [activePoNumbers]);

    // Dedup by po_number to count unique POs
    const poMap = new Map();
    for (const row of r.rows) {
      if (!poMap.has(row.po_number)) poMap.set(row.po_number, []);
      poMap.get(row.po_number).push(row);
    }

    // Build force majeure list
    const forceMajeurePos = [];
    for (const poNum of poMap.keys()) {
      const upd = updatesByPo[poNum];
      if (!upd) continue;
      const ddd = upd.filter(u => u.type === 'DDD_UPDATE').sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
      if (ddd?.reason === 'Force Majeure') forceMajeurePos.push({ po: poNum, status: ddd.status });
    }

    return Response.json({
      total_unique_pos: poMap.size,
      active_pos: activePoNumbers,
      r0105498_sub_po_rows: r.rows.filter(row => row.po_number === 'R0105498-CL'),
      force_majeure_pos_count: forceMajeurePos.length,
      force_majeure_pos: forceMajeurePos,
    });
  } catch (e) {
    return Response.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
});
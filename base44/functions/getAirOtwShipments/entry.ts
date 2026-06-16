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
    const { style_color, destination } = body;
    if (!style_color || !destination) {
      return Response.json({ error: 'style_color and destination are required' }, { status: 400 });
    }

    // Map raw destination names from sub_po_view (Edikted/EdiktedUK) to sd.code (US/UK).
    const destCode = destination === 'Edikted' ? 'US'
                   : destination === 'EdiktedUK' ? 'UK'
                   : destination;

    const client = await getPgClient();
    const res = await client.query(`
      SELECT
        ship.shipment_number,
        ship.departure_date AS departure_date,
        ship.departure_date + smd.est_transition_days AS est_arrival_date,
        sm.method AS shipping_method,
        SUM(pl_po.quantity) AS quantity
      FROM pl_po
      JOIN shipments ship                       ON pl_po.shipment_id = ship.id
      JOIN shipment_statuses st                 ON ship.status = st.id
      JOIN skus s                               ON pl_po.sku = s.sku
      JOIN style_colors sc                      ON sc.id = s.style_color
      JOIN shipment_destination sd              ON sd.id = ship.destination
      JOIN shipment_method_destinations smd     ON ship.method = smd.shipment_method
                                               AND ship.destination = smd.destination
      JOIN shipment_methods sm                  ON sm.id = ship.method
      WHERE upper(st.status) = 'ON THE WAY'
        AND ship.method <> 2
        AND sd.code = $1
        AND sc.style_color = $2
      GROUP BY ship.shipment_number, ship.departure_date, smd.est_transition_days, sm.method
      ORDER BY est_arrival_date ASC NULLS LAST
    `, [destCode, style_color]);

    const safeIso = (v) => {
      if (!v) return null;
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d.toISOString();
    };

    const shipments = res.rows.map(r => ({
      shipment_number: r.shipment_number,
      departure_date: safeIso(r.departure_date),
      est_arrival_date: safeIso(r.est_arrival_date),
      shipping_method: r.shipping_method,
      quantity: Number(r.quantity) || 0,
    }));

    return Response.json({ shipments });
  } catch (e) {
    console.error('Error in getAirOtwShipments:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});
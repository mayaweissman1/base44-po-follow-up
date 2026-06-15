import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DB_URL = Deno.env.get('EDIKTED_DB_URL');

// Returns the full list of collection_types ({id, name}).
// Used by the "May be urgent" settings modal so the user can pick a collection
// by name and the system stores the matching id.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const pg = await import('npm:pg@8.11.3');
    const Client = pg.default?.Client || pg.Client;
    const client = new Client({ connectionString: DB_URL, ssl: false });
    await client.connect();
    const res = await client.query(`SELECT id, name FROM collection_types ORDER BY name ASC`);
    await client.end();
    return Response.json({ collection_types: res.rows });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});
import { postgres } from "base44:private-data-sources/postgres";
import pg from "npm:pg@8.11.3";

// Connection to the workspace private data source "Prod DB RO".
// Reused across requests in the same worker, like before.
let _pgClient = null;

export async function getPgClient() {
  if (_pgClient) return _pgClient;
  const source = postgres("Prod DB RO");
  const client = new pg.Client({ connectionString: source.connectionString });
  client.on("error", () => { _pgClient = null; });
  await client.connect();
  _pgClient = client;
  return client;
}
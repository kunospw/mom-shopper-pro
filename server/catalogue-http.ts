import { createServer } from "node:http";
import { ingestCatalogue } from "./catalogue-runtime";

// Prepared VPS entry point. No startup/service/proxy changes are performed by building it.
const port = Number(process.env.CATALOGUE_PORT);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Set an explicit unused CATALOGUE_PORT");
const server = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (req.url !== "/api/ingest-catalogue") { res.writeHead(404); return res.end(); }
  if (req.method !== "POST") { res.writeHead(405); return res.end(); }
  let raw = "";
  req.setEncoding("utf8");
  try {
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 2900000) { res.writeHead(413); return res.end(JSON.stringify({ error: "upload-too-large" })); }
    }
    const result = await ingestCatalogue(JSON.parse(raw), req.headers.authorization ?? null);
    res.writeHead(result.status); res.end(JSON.stringify(result.body));
  } catch { res.writeHead(503); res.end(JSON.stringify({ error: "unavailable-or-invalid-request" })); }
});
server.requestTimeout = 60000;
server.headersTimeout = 10000;
server.setTimeout(65000);
// Loopback by default; a container-bridge address only when the proxy runs in Docker.
server.listen(port, process.env.CATALOGUE_HOST || "127.0.0.1");

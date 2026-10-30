import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ingestCatalogue } from "./catalogue-runtime";
import { handleShopChat } from "./shop-chat";

// Prepared VPS entry point. No startup/service/proxy changes are performed by building it.
const port = Number(process.env.CATALOGUE_PORT);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Set an explicit unused CATALOGUE_PORT");
const server = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  // Buyer shop assistant (docs/shop-assistant.md); only where it is switched on.
  if (req.url === "/api/shop-chat" && process.env.SHOP_CHAT_ENABLED === "1") return shopChat(req, res);
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
async function shopChat(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") { res.writeHead(405); return res.end(); }
  let raw = "";
  req.setEncoding("utf8");
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 64000) { res.writeHead(413); return res.end(JSON.stringify({ error: "request-too-large" })); }
  }
  let body: unknown = null;
  try { body = JSON.parse(raw); } catch { /* rejected by the handler */ }
  // The proxy sets X-Forwarded-For to the buyer's address; only the proxy can reach this port.
  const ip = String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim() || "unknown";
  const env = process.env;
  const result = await handleShopChat(body, { ip, env: {
    OLLAMA_API_KEY: env.OLLAMA_API_KEY, OLLAMA_MODEL: env.OLLAMA_MODEL, OLLAMA_HOST: env.OLLAMA_HOST,
    VITE_FIREBASE_PROJECT_ID: env.CATALOGUE_FIREBASE_PROJECT_ID, VITE_FIREBASE_API_KEY: env.SHOP_CHAT_FIREBASE_API_KEY,
    FIRESTORE_EMULATOR_HOST: env.FIRESTORE_EMULATOR_HOST,
  } });
  res.writeHead(result.status); res.end(JSON.stringify(result.body));
}
server.requestTimeout = 60000;
server.headersTimeout = 10000;
server.setTimeout(65000);
// Loopback by default; a container-bridge address only when the proxy runs in Docker.
server.listen(port, process.env.CATALOGUE_HOST || "127.0.0.1");

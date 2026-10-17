import { handleShopChat, type ChatEnv } from "../server/shop-chat";

/** Vercel function: POST /api/shop-chat (see server/shop-chat.ts and docs/shop-assistant.md). */
export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    /* invalid JSON is rejected by the handler */
  }
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const result = await handleShopChat(body, { ip, env: process.env as ChatEnv });
  return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}

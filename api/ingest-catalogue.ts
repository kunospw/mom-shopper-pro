import { ingestCatalogue } from "../server/catalogue-runtime";
// Deploy only on a runtime configured for a >=60s request window and <=3 MiB body.
export async function POST(request: Request) {
  let raw = "";
  const decoder = new TextDecoder();
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "invalid-request" }, { status: 400 });
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      raw += decoder.decode(value, { stream: true });
      if (raw.length > 2900000) return Response.json({ error: "upload-too-large" }, { status: 413 });
    }
    const result = await ingestCatalogue(JSON.parse(raw + decoder.decode()), request.headers.get("authorization"));
    return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "unavailable-or-invalid-request" }, { status: 400 }); }
  finally { await reader.cancel(); }
}

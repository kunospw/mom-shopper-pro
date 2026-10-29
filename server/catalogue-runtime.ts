import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { externalAdapters } from "./catalogue-adapters";
import { handleCatalogue } from "./catalogue-ingestion";
import { localOcr } from "./catalogue-local-ocr";
import { resolveShopeeLink } from "./catalogue-shopee";

export async function ingestCatalogue(body: unknown, authorization: string | null) {
  if (process.env.CATALOGUE_INGESTION_ENABLED !== "1") return { status: 503, body: { error: "ingestion-disabled" } };
  // Shopee-only deployments refuse file uploads before any OCR/AI work.
  if (process.env.CATALOGUE_FILE_IMPORT === "0" && (body as { action?: unknown } | null)?.action === "ingest") return { status: 503, body: { error: "file-import-disabled" } };
  const projectId = process.env.CATALOGUE_FIREBASE_PROJECT_ID;
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    if (!projectId?.startsWith("demo-") || !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)
      throw new Error("Use both emulators with a demo- project");
  } else if (projectId !== "truly-yours-51176") throw new Error("Unexpected LarisKu project");
  const app = getApps().find(a => a.name === "catalogue-ingestion") ?? initializeApp({ projectId, credential: applicationDefault() }, "catalogue-ingestion");
  const adapters = externalAdapters(process.env);
  const mode = process.env.CATALOGUE_OCR_ADAPTER || "vision";
  if (mode !== "vision" && mode !== "tesseract") throw new Error("Unsupported OCR adapter");
  if (mode === "tesseract") adapters.ocr = localOcr(process.env);
  const withLinks = { ...adapters, shopee: resolveShopeeLink };
  return handleCatalogue(body, authorization, { db: getFirestore(app), verify: token => getAuth(app).verifyIdToken(token, true), adapters: withLinks, pipeline: `${mode}-ollama-v2` });
}

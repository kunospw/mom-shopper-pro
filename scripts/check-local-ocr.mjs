import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, chmod, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bundle } from "./check-ingestion.mjs";
const { localOcr } = await bundle("server/catalogue-local-ocr.ts");
if (process.platform === "win32") {
  console.log("SKIP local OCR process stubs: the production runtime and these subprocess checks target Linux.");
} else {
  const folder = await mkdtemp(join(tmpdir(), "larisku-ocr-test-"));
  const binary = join(folder, "ocr-fixture");
  const image = await readFile("tests/e2e/fixtures/photo.png");
  const before = (await readdir(tmpdir())).filter(v => v.startsWith("larisku-ocr-") && !v.startsWith("larisku-ocr-test-"));
  const writeStub = async code => { await writeFile(binary, `#!/usr/bin/env node\n${code}\n`, { mode: 0o700 }); await chmod(binary, 0o700); };
  const ocr = localOcr({ PATH: process.env.PATH, CATALOGUE_TESSERACT_BIN: binary, CATALOGUE_OLLAMA_KEY: "must-not-pass-to-ocr" });
  try {
    await writeStub('if (!process.argv.includes("--psm") || process.env.CATALOGUE_OLLAMA_KEY) process.exit(2); process.stdout.write("Kemeja Rp25.000");');
    assert.equal(await ocr(image, "image/png", new AbortController().signal), "Kemeja Rp25.000");
    await writeStub('process.stdout.write("x".repeat(18001));');
    await assert.rejects(ocr(image, "image/png", new AbortController().signal), /ocr-empty-or-text-limit/);
    await writeStub('console.error("PRIVATE_OCR_CONTENT"); process.exit(1);');
    await assert.rejects(ocr(image, "image/png", new AbortController().signal), error => error.message === "local-ocr-failed");
    await writeStub('setInterval(() => {},1000);');
    const signal = new AbortController();
    const pending = ocr(image, "image/png", signal.signal);
    setTimeout(() => signal.abort(), 50);
    await assert.rejects(pending, /ocr-aborted/);
    await assert.rejects(ocr(Buffer.from("not a PNG"), "image/png", new AbortController().signal));
    const after = (await readdir(tmpdir())).filter(v => v.startsWith("larisku-ocr-") && !v.startsWith("larisku-ocr-test-"));
    assert.deepEqual(after.sort(), before.sort(), "temporary catalogue files cleaned on success/failure/abort");
    console.log("PASS local OCR adapter: bounded output, invalid files, subprocess failure, abort and private temporary-file cleanup.");
  } finally { await rm(folder, { recursive: true, force: true }); }
}

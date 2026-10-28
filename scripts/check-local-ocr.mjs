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
  // The 600px fixture is upscaled 2.8x through a one-page PDF before OCR.
  const renderer = join(folder, "render-fixture");
  await writeFile(renderer, '#!/usr/bin/env node\nconst a = process.argv; if (a[a.indexOf("-scale-to") + 1] !== "1680" || process.env.CATALOGUE_OLLAMA_KEY) process.exit(3);\nrequire("node:fs").writeFileSync(a.at(-1) + ".png", "rendered");\n', { mode: 0o700 });
  await chmod(renderer, 0o700);
  const ocr = localOcr({ PATH: process.env.PATH, CATALOGUE_TESSERACT_BIN: binary, CATALOGUE_PDFTOPPM_BIN: renderer, CATALOGUE_OLLAMA_KEY: "must-not-pass-to-ocr" });
  const word = (text, left) => `5\\t1\\t1\\t1\\t1\\t1\\t${left}\\t0\\t80\\t20\\t95\\t${text}`;
  try {
    await writeStub(`const a = process.argv; if (!a.includes("--psm") || a.at(-1) !== "tsv" || !a[2].endsWith("page.png") || process.env.CATALOGUE_OLLAMA_KEY) process.exit(2); process.stdout.write("header\\n${word("Kemeja", 0)}\\n${word("Rp25.000", 100)}");`);
    assert.equal(await ocr(image, "image/png", new AbortController().signal), "[Kolom 1]\nKemeja Rp25.000");
    await writeStub(`process.stdout.write("header\\n${word("x".repeat(18001), 0)}");`);
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

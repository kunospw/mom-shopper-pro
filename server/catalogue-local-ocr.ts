import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LIMITS } from "../src/lib/catalogue-ingestion";
import { validateUpload } from "./catalogue-adapters";

/** Small local OCR adapter. No shell, network, raw-text logging or model download. */
export function localOcr(env: NodeJS.ProcessEnv) {
  const childEnv = {
    PATH: env.PATH, LANG: "C.UTF-8", OMP_THREAD_LIMIT: "1",
    LD_LIBRARY_PATH: env.CATALOGUE_OCR_LIBRARY_PATH,
  };
  function execute(binary: string, args: string[], signal: AbortSignal) {
    return new Promise<Buffer>((resolve, reject) => {
      if (signal.aborted) return reject(new Error("ocr-aborted"));
      const child = spawn(binary, args, { shell: false, env: childEnv, stdio: ["ignore", "pipe", "ignore"] });
      const chunks: Buffer[] = []; let size = 0; let failure = "";
      const stop = (reason: string) => { failure = reason; child.kill("SIGKILL"); };
      const abort = () => stop("ocr-aborted");
      const timer = setTimeout(() => stop("ocr-timeout"), 12000);
      signal.addEventListener("abort", abort, { once: true });
      child.stdout.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > LIMITS.text * 4) stop("ocr-text-limit");
        else chunks.push(chunk);
      });
      child.on("error", () => { failure = "local-ocr-unavailable"; });
      child.on("close", code => {
        clearTimeout(timer); signal.removeEventListener("abort", abort);
        if (failure || code !== 0) reject(new Error(failure || "local-ocr-failed"));
        else resolve(Buffer.concat(chunks));
      });
    });
  }
  return async (bytes: Buffer, mime: string, signal: AbortSignal) => {
    await validateUpload(mime, bytes);
    // mkdtemp creates a private directory; user filenames never become paths/arguments.
    const directory = await mkdtemp(join(tmpdir(), "larisku-ocr-"));
    try {
      const input = join(directory, mime === "application/pdf" ? "input.pdf" : mime === "image/png" ? "input.png" : "input.jpeg");
      await writeFile(input, bytes, { mode: 0o600, flag: "wx" });
      let image = input;
      if (mime === "application/pdf") {
        await execute(env.CATALOGUE_PDFTOPPM_BIN || "pdftoppm", ["-f", "1", "-l", "1", "-singlefile", "-scale-to", "2400", "-png", input, join(directory, "page")], signal);
        image = join(directory, "page.png");
      }
      const args = [image, "stdout", "-l", "eng+ind", "--psm", env.CATALOGUE_TESSERACT_PSM === "3" ? "3" : "11"];
      if (env.CATALOGUE_TESSDATA_DIR) args.push("--tessdata-dir", env.CATALOGUE_TESSDATA_DIR);
      const text = (await execute(env.CATALOGUE_TESSERACT_BIN || "tesseract", args, signal)).toString("utf8").trim();
      if (!text || text.length > LIMITS.text) throw new Error("ocr-empty-or-text-limit");
      return text;
    } finally { await rm(directory, { recursive: true, force: true }); }
  };
}

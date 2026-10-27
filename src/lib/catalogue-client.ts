import { catalogueToken } from "@/lib/catalogue-token";
import { LIMITS, type JobView } from "./catalogue-ingestion";
export type ReviewJob = JobView & { revision: number };
export async function catalogueRequest<T = ReviewJob>(body: unknown, progress?: (percent: number) => void): Promise<T> {
  const token = await catalogueToken();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/ingest-catalogue");
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.timeout = 60000;
    xhr.upload.onprogress = event => { if (event.lengthComputable) progress?.(Math.round(100 * event.loaded / event.total)); };
    xhr.onerror = xhr.ontimeout = () => reject(new Error("Koneksi terputus. Coba lagi; permintaan yang sama aman diulang."));
    xhr.onload = () => {
      try {
        const result = JSON.parse(xhr.responseText);
        if (xhr.status !== 200) throw new Error(result.error || "Permintaan gagal");
        resolve(result);
      } catch (e) { reject(e); }
    };
    xhr.send(JSON.stringify(body));
  });
}
export async function uploadCatalogue(file: File, progress: (percent: number) => void) {
  if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type) || !file.size || file.size > LIMITS.bytes)
    throw new Error("Gunakan PDF/JPEG/PNG maksimal 2 MiB. PDF hanya satu halaman.");
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Berkas tidak terbaca"));
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.readAsDataURL(file);
  });
  return catalogueRequest({ action: "ingest", mime: file.type, data }, progress);
}

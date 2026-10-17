/** Where the square crop sits: center as a fraction of the image, and zoom (1 = largest square). */
export interface PhotoCrop {
  x: number;
  y: number;
  zoom: number;
}
export const centerCrop: PhotoCrop = { x: 0.5, y: 0.5, zoom: 1 };
export const MAX_ZOOM = 3;
const MAX_PHOTO_CHARS = 180000;

/** Reads and checks a photo file (type, size, pixel count). */
export async function loadPhoto(source: File | string): Promise<HTMLImageElement> {
  if (typeof source !== "string" && (!["image/jpeg", "image/png", "image/webp"].includes(source.type) || source.size > 10 * 1024 * 1024))
    throw new Error("Pilih foto PNG, JPG, atau WebP maksimal 10 MB.");
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const value = new Image();
      value.onload = () => resolve(value);
      value.onerror = () => reject(new Error("Foto tidak dapat dibaca. Pilih foto lain."));
      value.src = url;
    });
    if (image.naturalWidth * image.naturalHeight > 45_000_000) throw new Error("Ukuran foto terlalu besar. Pilih foto yang lebih kecil.");
    // Decode fully before the object URL is revoked.
    await image.decode?.().catch(() => undefined);
    return image;
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}

/** Keeps the crop inside the image: returns the square's side and top-left corner in image pixels. */
export function cropRect(width: number, height: number, crop: PhotoCrop) {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, crop.zoom || 1));
  const side = Math.min(width, height) / zoom;
  const left = Math.min(width - side, Math.max(0, crop.x * width - side / 2));
  const top = Math.min(height - side, Math.max(0, crop.y * height - side / 2));
  return { side, left, top, zoom };
}

/** Square crop, resized until it fits the catalog limit (WebP). */
export function squarePhoto(image: HTMLImageElement, crop: PhotoCrop = centerCrop): string {
  const { side, left, top } = cropRect(image.naturalWidth, image.naturalHeight, crop);
  for (const size of [800, 640, 480, 360]) {
    const out = Math.max(1, Math.round(Math.min(size, side)));
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const context = canvas.getContext("2d");
    if (!context) break;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, out, out);
    context.drawImage(image, left, top, side, side, 0, 0, out, out);
    const data = canvas.toDataURL("image/webp", 0.8);
    if (data.length <= MAX_PHOTO_CHARS) return data;
  }
  throw new Error("Foto masih terlalu besar setelah diperkecil. Pilih foto lain.");
}

/** Upload helper: reads the file and crops it to a centered square automatically. */
export async function catalogPhoto(file: File): Promise<string> {
  return squarePhoto(await loadPhoto(file));
}

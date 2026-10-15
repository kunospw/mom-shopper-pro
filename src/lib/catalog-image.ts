export async function catalogPhoto(file: File): Promise<string> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error("Pilih foto PNG, JPG, atau WebP maksimal 10 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const value = new Image();
      value.onload = () => resolve(value);
      value.onerror = reject;
      value.src = url;
    });
    if (image.naturalWidth * image.naturalHeight > 45_000_000)
      throw new Error(
        "Ukuran foto terlalu besar. Pilih foto yang lebih kecil.",
      );
    for (const size of [800, 600, 400]) {
      const scale = Math.min(
        1,
        size / Math.max(image.naturalWidth, image.naturalHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas
        .getContext("2d")
        .drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/webp", 0.78);
      if (data.length <= 180000) return data;
    }
    throw new Error(
      "Foto masih terlalu besar setelah diperkecil. Pilih foto lain.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

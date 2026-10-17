import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Maximize, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MAX_ZOOM, centerCrop, cropRect, squarePhoto, type PhotoCrop } from "@/lib/catalog-image";

/**
 * Square crop editor: drag the photo (or use arrow keys) to move it, slider or
 * buttons to zoom. "Pakai foto" returns the cropped catalog image.
 */
export function PhotoCropper({
  image,
  initial = centerCrop,
  onDone,
  onCancel,
}: {
  image: HTMLImageElement | null;
  initial?: PhotoCrop;
  onDone: (data: string, crop: PhotoCrop) => void;
  onCancel: () => void;
}) {
  const [crop, setCrop] = useState<PhotoCrop>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; crop: PhotoCrop } | null>(null);
  useEffect(() => {
    setCrop(initial);
    setError("");
  }, [image, initial]);
  // Preview drawn from the decoded image: its original object URL may already be released.
  const preview = useMemo(() => {
    if (!image) return "";
    const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  }, [image]);

  if (!image) return null;
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const rect = cropRect(w, h, crop);
  // Keep the stored center in sync with clamping, so dragging past an edge doesn't "stick".
  const center = { x: (rect.left + rect.side / 2) / w, y: (rect.top + rect.side / 2) / h };
  const update = (next: Partial<PhotoCrop>) => setCrop((c) => ({ ...c, ...next }));
  const zoomBy = (delta: number) => update({ ...center, zoom: Math.min(MAX_ZOOM, Math.max(1, rect.zoom + delta)) });
  // Shift in image fractions for a pointer move of dx, dy screen pixels.
  function moveBy(dx: number, dy: number, from: PhotoCrop) {
    const size = frame.current?.clientWidth || 300;
    const pxPerImagePx = size / cropRect(w, h, from).side;
    const fromRect = cropRect(w, h, from);
    const cx = (fromRect.left + fromRect.side / 2 - dx / pxPerImagePx) / w;
    const cy = (fromRect.top + fromRect.side / 2 - dy / pxPerImagePx) / h;
    const clamped = cropRect(w, h, { ...from, x: cx, y: cy });
    setCrop({ zoom: from.zoom, x: (clamped.left + clamped.side / 2) / w, y: (clamped.top + clamped.side / 2) / h });
  }

  const scale = 100 / rect.side; // percent of frame per image pixel
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent className="max-w-[440px] gap-4 p-5">
        <DialogHeader className="text-left">
          <DialogTitle>Sesuaikan foto</DialogTitle>
          <DialogDescription>Geser foto untuk memilih bagian yang tampil. Foto katalog berbentuk persegi.</DialogDescription>
        </DialogHeader>
        <div
          ref={frame}
          role="application"
          tabIndex={0}
          aria-label="Area potong foto. Gunakan panah untuk menggeser, plus dan minus untuk memperbesar."
          className="relative aspect-square w-full touch-none cursor-grab select-none overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture?.(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, crop: { ...center, zoom: rect.zoom } };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            moveBy(e.clientX - drag.current.x, e.clientY - drag.current.y, drag.current.crop);
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onWheel={(e) => zoomBy(e.deltaY < 0 ? 0.1 : -0.1)}
          onKeyDown={(e) => {
            const step = 12;
            const keys: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
            if (keys[e.key]) {
              e.preventDefault();
              moveBy(keys[e.key][0], keys[e.key][1], { ...center, zoom: rect.zoom });
            } else if (e.key === "+" || e.key === "=") zoomBy(0.2);
            else if (e.key === "-") zoomBy(-0.2);
          }}
        >
          <img
            src={preview}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none"
            style={{ width: `${w * scale}%`, height: `${h * scale}%`, left: `${-rect.left * scale}%`, top: `${-rect.top * scale}%` }}
          />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i} className="border border-white/25" />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" aria-label="Perkecil" onClick={() => zoomBy(-0.2)} disabled={rect.zoom <= 1}>
            <Minus />
          </Button>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.05}
            value={rect.zoom}
            aria-label="Perbesar foto"
            onChange={(e) => update({ ...center, zoom: Number(e.target.value) })}
            className="h-2 flex-1 accent-[hsl(var(--primary))]"
          />
          <Button type="button" variant="ghost" size="icon" aria-label="Perbesar" onClick={() => zoomBy(0.2)} disabled={rect.zoom >= MAX_ZOOM}>
            <Plus />
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Kembali ke tengah" onClick={() => setCrop(centerCrop)}>
            <Maximize />
          </Button>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={onCancel}>
            Batal
          </Button>
          <Button
            type="button"
            className="h-11 flex-1"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              // Let the button show its busy state before the canvas work.
              window.setTimeout(() => {
                try {
                  const next = { ...center, zoom: rect.zoom };
                  onDone(squarePhoto(image, next), next);
                } catch (failure) {
                  setError(failure instanceof Error ? failure.message : "Foto belum bisa dipotong.");
                } finally {
                  setBusy(false);
                }
              }, 20);
            }}
          >
            {busy && <Loader2 className="animate-spin" />}
            Pakai foto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

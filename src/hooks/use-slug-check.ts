import { useEffect, useState } from "react";
import { slugSchema } from "@/lib/catalog";

export type SlugState = "idle" | "checking" | "free" | "taken" | "invalid";

/** Validates a shop link and checks it is free (debounced). The shop's own current link counts as free. */
export function useSlugCheck(slug: string, currentSlug: string, checkSlug: (slug: string) => Promise<boolean>) {
  const [state, setState] = useState<SlugState>("idle");
  const [hint, setHint] = useState("");
  useEffect(() => {
    if (!slug || slug === currentSlug) {
      setState("idle");
      setHint("");
      return;
    }
    const parsed = slugSchema.safeParse(slug);
    if (!parsed.success) {
      setState("invalid");
      setHint(parsed.error.issues[0].message);
      return;
    }
    setState("checking");
    let active = true;
    const timer = window.setTimeout(() => {
      checkSlug(slug)
        .then((free) => {
          if (!active) return;
          setState(free ? "free" : "taken");
          setHint(free ? "Tautan ini tersedia." : "Tautan ini sudah dipakai. Coba nama lain.");
        })
        .catch(() => {
          if (!active) return;
          setState("idle");
          setHint("Ketersediaan belum bisa diperiksa. Anda tetap bisa menyimpan.");
        });
    }, 400);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [slug, currentSlug, checkSlug]);
  return { state, hint };
}

#!/usr/bin/env node
/**
 * Renders public/og-image.png (1200x630), the picture chat apps show when the
 * site's link is shared. Run it again after changing the name, tagline or
 * colors:  node scripts/make-og-image.mjs
 *
 * Drawn with system fonts only, so it needs no network.
 */
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../public/og-image.png", import.meta.url));
const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; background: #2F5D46; color: #fff;
    font-family: "Plus Jakarta Sans", "Segoe UI", "Helvetica Neue", Arial, "Liberation Sans", "DejaVu Sans", sans-serif; }
  .a { position: absolute; right: -170px; top: -190px; width: 620px; height: 620px; border-radius: 50%; background: #376B51; }
  .b { position: absolute; left: -150px; bottom: -260px; width: 520px; height: 520px; border-radius: 50%; background: #2A5340; }
  main { position: absolute; inset: 0; padding: 72px 80px; display: flex; flex-direction: column; }
  .brand { display: flex; align-items: center; gap: 20px; font-size: 40px; font-weight: 700; letter-spacing: -0.5px; }
  .mark { width: 72px; height: 72px; border-radius: 20px; background: #fff; display: flex; align-items: center; justify-content: center; }
  h1 { margin-top: 52px; max-width: 960px; font-size: 68px; line-height: 1.08; font-weight: 700; letter-spacing: -2px; }
  p { margin-top: 22px; max-width: 900px; font-size: 30px; line-height: 1.35; color: #D7E4D9; }
  ul { margin-top: auto; display: flex; gap: 14px; list-style: none; padding: 0; }
  li { font-size: 24px; font-weight: 600; padding: 12px 22px; border-radius: 999px; background: rgba(255,255,255,.12); border: 1.5px solid rgba(255,255,255,.2); }
</style></head><body><div class="a"></div><div class="b"></div><main>
  <div class="brand"><span class="mark"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2F5D46" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></span>LarisKu</div>
  <h1>Toko online lewat WhatsApp, plus catatan usaha.</h1>
  <p>Untuk penjual rumahan dan reseller. Pencatatan gratis selamanya.</p>
  <ul><li>Link toko sendiri</li><li>Pesanan masuk WhatsApp</li><li>Laporan untung</li></ul>
</main></body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.screenshot({ path: out, type: "png" });
} finally {
  await browser.close();
}
console.log(`Wrote ${out}`);

import { test } from "@playwright/test";
import assert from "node:assert/strict";

// Sign-in states driven by the auth mock: ?signin=hang|fail|blocked|closed
for (const mode of ["idle", "hang", "fail", "blocked", "closed"]) {
  test(`Login · ${mode}`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.goto(`/login?auth=out&signin=${mode}`);
    await page.getByRole("heading", { name: "Selamat datang" }).first().waitFor();
    await page.locator("text=Dari rumah, laris ke mana-mana >> visible=true").first().waitFor();
    if (mode !== "idle") {
      await page.getByRole("button", { name: "Masuk dengan Google" }).click();
      if (mode === "hang") {
        await page.getByRole("button", { name: "Sedang masuk…" }).waitFor();
        await page.locator("text=Pilih akun di jendela Google >> visible=true").waitFor();
      }
      if (mode === "fail") {
        await page.getByRole("alert").filter({ hasText: "Belum berhasil masuk." }).waitFor();
        await page.getByRole("button", { name: "Coba lagi dengan Google" }).waitFor();
      }
      if (mode === "blocked") await page.getByRole("button", { name: "Salin alamat halaman" }).waitFor();
      if (mode === "closed") {
        await page.waitForTimeout(600);
        await page.getByRole("button", { name: "Masuk dengan Google" }).waitFor();
        assert.equal(await page.getByRole("alert").count(), 0, "closing the popup is not an error");
      }
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, "no horizontal overflow");
    // The Google button stays on screen without scrolling.
    const button = await page.getByRole("button", { name: /Masuk dengan Google|Sedang masuk|Coba lagi/ }).last().boundingBox();
    assert.ok(button && button.y + button.height <= page.viewportSize().height, "sign-in button visible without scrolling");
    assert.deepEqual(errors, []);
  });
}

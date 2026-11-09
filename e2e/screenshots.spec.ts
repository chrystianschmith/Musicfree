/** Regenerates the README screenshots: `pnpm e2e screenshots`. */
import { test } from "@playwright/test";

const out = (n: string) => `docs/screenshots/${n}.png`;

test.describe.configure({ mode: "serial" });
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to regenerate");

test("home", async ({ page }) => {
  await page.goto("/#/album/al-neon");
  await page.getByRole("listitem").filter({ hasText: "Luzes da cidade" }).dblclick();
  await page.waitForTimeout(9000);
  await page.goto("/#/");
  await page.waitForTimeout(800);
  await page.screenshot({ path: out("home") });
  await page.goto("/#/search?q=noite&f=all");
  await page.waitForTimeout(800);
  await page.screenshot({ path: out("search") });
  await page.goto("/#/artist/ar-noite-clara");
  await page.waitForTimeout(800);
  await page.screenshot({ path: out("artist") });
  await page.goto("/#/album/al-neon");
  await page.waitForTimeout(800);
  await page.mouse.move(10, 10);
  await page.screenshot({ path: out("album") });
  await page.locator("footer").getByRole("button", { name: "Letra" }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: out("nowplaying") });
});

// Usage: node scripts/shot.mjs <url-hash> <out.png> [clickSelector...]
// Renders the browser build (mock data) at 1280x800 and saves a screenshot.
import { chromium } from "@playwright/test";

const [, , hash = "/", out = "docs/screenshots/shot.png", ...clicks] = process.argv;
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
});
page.on("pageerror", (e) => console.error("pageerror:", e.message));
await page.goto(`http://localhost:1420/#${hash}`);
await page.waitForTimeout(700);
for (const c of clicks) {
  if (c.startsWith("wait:")) await page.waitForTimeout(Number(c.slice(5)));
  else if (c.startsWith("type:")) await page.keyboard.type(c.slice(5), { delay: 30 });
  else if (c.startsWith("key:")) await page.keyboard.press(c.slice(4));
  else await page.locator(c).first().click();
  await page.waitForTimeout(450);
}
await page.screenshot({ path: out });
await browser.close();
console.log("saved", out);

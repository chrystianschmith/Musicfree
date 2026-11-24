import { expect, test } from "@playwright/test";

const WINDOWS_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0";

// The smallest window the app allows (960×600), at the display scales Windows laptops use.
for (const scale of [1.25, 1.5]) {
  test.describe(`Windows at ${scale * 100}%`, () => {
    test.use({
      viewport: { width: 960, height: 600 },
      deviceScaleFactor: scale,
      userAgent: WINDOWS_UA,
    });

    test("uses the Windows font and fits the minimum window", async ({ page }) => {
      await page.goto("/#/album/al-neon");
      await page.locator("main").getByRole("button", { name: "Tocar", exact: true }).click();
      await expect(page.locator("html")).toHaveClass(/\bwin\b/);
      const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
      expect(font).toContain("Segoe UI Variable");

      // Nothing in the player bar is pushed off screen or overlaps the window edge.
      const overflow = await page.evaluate(() => {
        const bar = document.querySelector("footer")!;
        return [...bar.querySelectorAll("button, input")]
          .map((el) => el.getBoundingClientRect())
          .some((r) => r.width > 0 && (r.right > window.innerWidth + 0.5 || r.left < -0.5));
      });
      expect(overflow).toBe(false);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    });

    test("every icon control is at least 32 px to click", async ({ page }) => {
      await page.goto("/#/album/al-neon");
      await page.locator("main").getByRole("button", { name: "Tocar", exact: true }).click();
      const small = await page.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLButtonElement>(
            "footer button[aria-label], nav button[aria-label]",
          ),
        ]
          .filter((b) => b.offsetParent !== null)
          .map((b) => ({ label: b.getAttribute("aria-label"), r: b.getBoundingClientRect() }))
          .filter(({ r }) => r.width < 31.5 || r.height < 31.5)
          .map(({ label, r }) => `${label} ${Math.round(r.width)}×${Math.round(r.height)}`),
      );
      expect(small).toEqual([]);
    });
  });
}

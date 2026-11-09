import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("search, play, open now playing, like and build a playlist", async ({ page }) => {
  await page.getByRole("link", { name: "Buscar" }).click();
  const box = page.getByLabel("Buscar", { exact: true });
  await box.fill("noite");
  await box.press("Enter");

  await page.getByRole("listitem").filter({ hasText: "Luzes da cidade" }).first().dblclick();
  const bar = page.locator("footer");
  await expect(bar).toContainText("Luzes da cidade");
  await expect(bar.getByRole("button", { name: "Pausar" })).toBeVisible();

  await bar.getByRole("button", { name: "Abrir tocando agora" }).click();
  const np = page.locator('section[aria-label="Tocando agora"]');
  await expect(np.getByRole("tab", { name: "Letra" })).toHaveAttribute("aria-selected", "true");
  await expect(np).toContainText("Atravessei a avenida");
  await page.keyboard.press("Escape");
  await expect(np).toHaveAttribute("aria-hidden", "true");

  await bar.getByRole("button", { name: "Curtir" }).click();
  await page.getByRole("link", { name: "Curtidas" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Luzes da cidade" })).toBeVisible();

  await page.getByRole("button", { name: "Nova playlist" }).click();
  await expect(page.getByRole("heading", { name: "Minha playlist nº 1" })).toBeVisible();
  await expect(page.getByRole("navigation")).toContainText("Minha playlist nº 1");
});

test("queue controls: play next, shuffle and repeat", async ({ page }) => {
  await page.goto("/#/album/al-neon");
  await page.locator("main").getByRole("button", { name: "Tocar", exact: true }).click();
  const bar = page.locator("footer");
  await expect(bar).toContainText("Luzes da cidade");

  await bar.getByRole("button", { name: "Próxima" }).click();
  await expect(bar).toContainText("Horizonte");

  await page.getByRole("listitem").filter({ hasText: "Último trem" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Tocar a seguir" }).click();
  await bar.getByRole("button", { name: "Próxima" }).click();
  await expect(bar).toContainText("Último trem");

  const repeat = bar.getByRole("button", { name: "Repetir" });
  await repeat.click();
  await expect(bar.getByRole("button", { name: "Repetir uma" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("keyboard shortcut / focuses search", async ({ page }) => {
  await page.keyboard.press("/");
  await expect(page.getByLabel("Buscar", { exact: true })).toBeFocused();
});

test("restores the last queue paused after reload", async ({ page }) => {
  await page.goto("/#/album/al-neon");
  await page.getByRole("listitem").filter({ hasText: "Avenida" }).dblclick();
  await expect(page.locator("footer")).toContainText("Avenida");
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.locator("footer")).toContainText("Avenida");
  await expect(page.locator("footer").getByRole("button", { name: "Tocar" })).toBeVisible();
});

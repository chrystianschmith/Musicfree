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

test("queue tab lists upcoming tracks without render loops", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/#/album/al-neon");
  await page.getByRole("listitem").filter({ hasText: "Luzes da cidade" }).dblclick();
  await page.locator("footer").getByRole("button", { name: "Fila" }).click();
  const np = page.locator('section[aria-label="Tocando agora"]');
  await expect(np.getByRole("tab", { name: "A seguir" })).toHaveAttribute("aria-selected", "true");
  await expect(np.getByRole("listitem").filter({ hasText: "Horizonte" })).toBeVisible();
  expect(errors.filter((e) => /getSnapshot|Maximum update depth/i.test(e))).toEqual([]);
});

test("history records a track once per play, not on app start", async ({ page }) => {
  await page.goto("/#/album/al-neon");
  await page.getByRole("listitem").filter({ hasText: "Madrugada" }).dblclick();
  await expect(page.locator("footer")).toContainText("Madrugada");
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.locator("footer")).toContainText("Madrugada");
  await page.getByRole("link", { name: "Histórico" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Madrugada" })).toHaveCount(1);
});

const seekTo = async (page: import("@playwright/test").Page, fraction: number) => {
  const bb = (await page.getByRole("slider", { name: "Progresso" }).boundingBox())!;
  await page.mouse.click(bb.x + bb.width * fraction, bb.y + bb.height / 2);
};

test("endless queue: similar tracks are added when the last track starts", async ({ page }) => {
  await page.goto("/#/album/al-neon");
  await page.getByRole("listitem").filter({ hasText: "Último trem" }).dblclick();
  await page.locator("footer").getByRole("button", { name: "Fila" }).click();
  const np = page.locator('section[aria-label="Tocando agora"]');
  await expect.poll(() => np.getByRole("listitem").count()).toBeGreaterThan(5);
  await expect(np).not.toContainText("Nada na fila");
});

test("home recommends from what was listened to, ignoring quick skips", async ({ page }) => {
  await page.goto("/#/");
  await expect(page.getByRole("heading", { name: "Feito para você" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Voltar a ouvir" })).toHaveCount(0);

  await page.goto("/#/album/al-neon");
  const bar = page.locator("footer");
  for (const title of ["Luzes da cidade", "Horizonte"]) {
    await page.getByRole("listitem").filter({ hasText: title }).first().dblclick();
    await expect(bar).toContainText(title);
    await page.waitForTimeout(700);
    await seekTo(page, 0.9);
    await page.waitForTimeout(700);
  }
  // Skipped right away: must not show up as something to replay.
  await page.getByRole("listitem").filter({ hasText: "Madrugada" }).first().dblclick();
  await page.waitForTimeout(700);
  await page.getByRole("listitem").filter({ hasText: "Avenida" }).first().dblclick();
  await page.waitForTimeout(500);

  await page.getByRole("link", { name: "Início" }).click();
  await expect(page.getByRole("heading", { name: "Seu mix de hoje" })).toBeVisible();
  const replay = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Voltar a ouvir" }) });
  await expect(replay).toContainText("Luzes da cidade");
  await expect(replay).toContainText("Horizonte");
  await expect(replay).not.toContainText("Madrugada");
  await expect(page.getByRole("heading", { name: /^Porque você ouviu/ })).toBeVisible();
});

test("sidebar collapses to icons and remembers it", async ({ page }) => {
  await page.getByRole("button", { name: "Recolher barra lateral" }).click();
  await expect(page.getByRole("button", { name: "Expandir barra lateral" })).toBeVisible();
  const w = (await page.getByRole("navigation").boundingBox())!.width;
  expect(w).toBeLessThan(100);
  await page.reload();
  await expect(page.getByRole("button", { name: "Expandir barra lateral" })).toBeVisible();
});

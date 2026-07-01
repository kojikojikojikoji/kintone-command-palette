import { expect, test } from "@playwright/test";
import { login, openAppIndex, openPalette } from "./helpers";

// These specs describe the main user flows (TC-16..TC-28). They run against a
// development kintone environment that has the command-palette plugin installed
// and are not part of CI. Run with: npx playwright test.

test.beforeEach(async ({ page }) => {
  await login(page);
  await openAppIndex(page);
});

test("TC-16: Ctrl+K opens the palette and focuses the input", async ({ page }) => {
  await openPalette(page);
  const focused = await page.evaluate(() =>
    document.activeElement?.classList.contains("kp-cmdp-search__input"),
  );
  expect(focused).toBe(true);
});

test("TC-21: Esc closes the palette", async ({ page }) => {
  await openPalette(page);
  await page.keyboard.press("Escape");
  await expect(page.locator(".kp-cmdp-overlay.kp-cmdp-open")).toHaveCount(0);
});

test("TC-22: Tab narrows the source filter", async ({ page }) => {
  await openPalette(page);
  await page.keyboard.press("Tab");
  await expect(page.locator(".kp-cmdp-filter")).toHaveText("アクション");
  await page.keyboard.press("Tab");
  await expect(page.locator(".kp-cmdp-filter")).toHaveText("ビュー");
});

test("TC-27: no results shows the empty message", async ({ page }) => {
  await openPalette(page);
  await page.fill(".kp-cmdp-search__input", "zzzzzz");
  await expect(page.locator(".kp-cmdp-empty")).toHaveText("該当する項目がありません");
});

test("TC-28: fast navigation keeps a single palette instance", async ({ page }) => {
  await openPalette(page);
  await page.keyboard.press("Escape");
  await openPalette(page);
  await expect(page.locator(".kp-cmdp-overlay")).toHaveCount(1);
});

import type { Page } from "@playwright/test";

// Shared helpers for the command-palette E2E specs. Connection details come from
// environment variables so nothing environment-specific is committed:
//   KINTONE_BASE_URL   e.g. https://example.cybozu.com
//   KINTONE_USERNAME   login name
//   KINTONE_PASSWORD   password
//   KINTONE_APP_ID     app id with the demo form and the plugin installed

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export async function login(page: Page): Promise<void> {
  const base = requireEnv("KINTONE_BASE_URL");
  await page.goto(`${base}/login`);
  await page.fill('input[name="username"]', requireEnv("KINTONE_USERNAME"));
  await page.fill('input[name="password"]', requireEnv("KINTONE_PASSWORD"));
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForLoadState("networkidle");
}

export async function openAppIndex(page: Page): Promise<void> {
  const base = requireEnv("KINTONE_BASE_URL");
  const appId = requireEnv("KINTONE_APP_ID");
  await page.goto(`${base}/k/${appId}/`);
  await page.waitForLoadState("networkidle");
}

export async function openPalette(page: Page): Promise<void> {
  await page.keyboard.press("Control+k");
  await page.waitForSelector(".kp-cmdp-overlay.kp-cmdp-open", { state: "visible" });
}

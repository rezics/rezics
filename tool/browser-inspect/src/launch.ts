import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type BrowserContext, type Page } from "playwright";

const WORKBENCH_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const DEFAULT_PROFILE_DIR = path.join(WORKBENCH_DIR, "profile");

export type BrowserInvestigation = {
  context: BrowserContext;
  page: Page;
  profileDir: string;
};

export type OpenInvestigationPageOptions = {
  url: string;
  profileDir?: string;
  devtools?: boolean;
  timeoutMs?: number;
};

export async function openInvestigationPage({
  url,
  profileDir = DEFAULT_PROFILE_DIR,
  devtools = true,
  timeoutMs = 45_000,
}: OpenInvestigationPageOptions): Promise<BrowserInvestigation> {
  // Persistent profile state is intentional: CF checks, login, consent, and
  // other human verification should survive repeated investigation scripts.
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    args: devtools ? ["--auto-open-devtools-for-tabs"] : [],
  });
  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });

  return { context, page, profileDir };
}

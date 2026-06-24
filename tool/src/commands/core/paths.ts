import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = resolve(here, "../../../..");

export const I18N_LOCALES_ROOT = join(REPO_ROOT, "packages/i18n/locales");
export const UI_LOCALES_ROOT = join(REPO_ROOT, "packages/ui/locales");

export function toRepoRelPath(absPath: string): string {
  return relative(REPO_ROOT, absPath).replaceAll("\\", "/");
}

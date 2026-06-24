export {
  I18N_LOCALES_ROOT,
  REPO_ROOT,
  UI_LOCALES_ROOT,
} from "../../core/paths";

import { toRepoRelPath } from "../../core/paths";

const EXEMPT_DIR_PATTERNS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".output",
  ".next",
  ".vite",
  ".turbo",
  "coverage",
];

const EXEMPT_PACKAGES = new Set(["auth"]);

export function isExemptPath(absPath: string): boolean {
  const relPath = toRepoRelPath(absPath);
  if (relPath.startsWith("..")) return true;

  return EXEMPT_DIR_PATTERNS.some(
    (pattern) =>
      relPath === pattern ||
      relPath.startsWith(`${pattern}/`) ||
      relPath.includes(`/${pattern}/`) ||
      relPath.endsWith(`/${pattern}`),
  );
}

export function isExemptPackage(absPath: string): boolean {
  const relPath = toRepoRelPath(absPath);
  const match = relPath.match(/^packages\/([^/]+)/);
  if (!match?.[1]) return false;
  return EXEMPT_PACKAGES.has(match[1]);
}

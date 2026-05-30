import { relative } from "node:path";

export const REPO_ROOT = new URL(
  "../../../..",
  import.meta.url,
).pathname.replace(/\/$/, "");

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
  "prisma/generated",
];

const EXEMPT_PACKAGES = new Set(["auth"]);

export function isExemptPath(absPath: string): boolean {
  const relPath = relative(REPO_ROOT, absPath);
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
  const relPath = relative(REPO_ROOT, absPath);
  const match = relPath.match(/^package\/([^/]+)/);
  if (!match?.[1]) return false;
  return EXEMPT_PACKAGES.has(match[1]);
}

import path from "node:path";

const SCRIPT_DIR = path.dirname(Bun.main);

export const ROOT_DIR = path.resolve(SCRIPT_DIR, "..", "..", "..", "..");

export function getPackageDir(pkg: string): string {
  return path.join(ROOT_DIR, "packages", pkg);
}

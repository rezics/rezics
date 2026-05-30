import path from "node:path";
import type { PrismaPackage } from "./packages";

const SCRIPT_DIR = path.dirname(Bun.main);

export const ROOT_DIR = path.resolve(SCRIPT_DIR, "..", "..", "..", "..");

export function getPackageDir(pkg: PrismaPackage): string {
  return path.join(ROOT_DIR, "package", pkg);
}

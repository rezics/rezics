import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { SEED_CACHE_DIR } from "./cache-dir";

const ONE_HOUR_MS = 60 * 60 * 1000;

export function sweepStaleEditDirs(now: number = Date.now()): void {
  let entries: string[];
  try {
    entries = readdirSync(SEED_CACHE_DIR);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.startsWith("edit-")) continue;
    const path = join(SEED_CACHE_DIR, entry);
    try {
      const stats = statSync(path);
      if (!stats.isDirectory()) continue;
      if (now - stats.mtimeMs <= ONE_HOUR_MS) continue;
      rmSync(path, { recursive: true, force: true });
    } catch {
      // ignore — best-effort cleanup
    }
  }
}

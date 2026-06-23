import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const base = "packages/frontend/src/lib/i18n/languages";
const enDir = join(base, "en-US");
const zhDir = join(base, "zh-CN");

function flatten(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    out.push(...flatten(v, key));
  }
  return out;
}

function load(dir: string, file: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(join(dir, file), "utf8"));
  } catch {
    return {};
  }
}

const enFiles = readdirSync(enDir).filter((f) => f.endsWith(".json"));
let total = 0;
for (const file of enFiles.sort()) {
  const enKeys = new Set(flatten(load(enDir, file)));
  const zhKeys = new Set(flatten(load(zhDir, file)));
  const missing = [...enKeys].filter((k) => !zhKeys.has(k));
  const zhExtra = [...zhKeys].filter((k) => !enKeys.has(k));
  if (missing.length || zhExtra.length) {
    console.log(`\n## ${file}`);
    if (missing.length) {
      total += missing.length;
      console.log(`  MISSING in zh-Hant (${missing.length}):`);
      for (const k of missing) console.log(`    - ${k}`);
    }
    if (zhExtra.length) {
      console.log(`  EXTRA in zh-Hant (${zhExtra.length}):`);
      for (const k of zhExtra) console.log(`    + ${k}`);
    }
  }
}
console.log(`\nTOTAL missing zh-Hant keys: ${total}`);

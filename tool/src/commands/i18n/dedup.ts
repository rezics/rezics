import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const base = "package/i18n/locales";
const apply = process.argv.includes("--apply");

function countTopLevelDuplicates(raw: string): Map<string, number> {
  // Top-level keys only: lines like `  "key": ...` at two-space indent.
  const counts = new Map<string, number>();
  for (const line of raw.split("\n")) {
    const m = line.match(/^ {2}"((?:[^"\\]|\\.)*)":/);
    const key = m?.[1];
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

let totalFixed = 0;
for (const loc of readdirSync(base)) {
  const dir = join(base, loc);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const path = join(dir, file);
    const raw = readFileSync(path, "utf8");
    const counts = countTopLevelDuplicates(raw);
    const dups = [...counts.entries()].filter(([, n]) => n > 1);
    if (dups.length === 0) continue;
    const extra = dups.reduce((a, [, n]) => a + (n - 1), 0);
    console.log(
      `${loc}/${file}: ${dups.length} duplicated key(s), ${extra} extra line(s)`,
    );
    for (const [k, n] of dups.sort((a, b) => b[1] - a[1]).slice(0, 5)) {
      console.log(`    "${k}" x${n}`);
    }
    if (apply) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      writeFileSync(path, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
      totalFixed++;
    }
  }
}
console.log(apply ? `\nRewrote ${totalFixed} file(s).` : "\n(dry run)");

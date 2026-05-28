#!/usr/bin/env bun
/**
 * Split the legacy flat catalog at `package/i18n/messages/{locale}.json` into
 * per-namespace files under `public/locales/{locale}/{ns}.json`. Emit
 * `tool/scripts/i18n/key-map.json` mapping every legacy flat key to its new
 * `<ns>:<key>` form (identity-preserving for keys not chosen for merge).
 *
 * Semantic merges from `dedup-report.json` are applied as identity rewrites
 * to the canonical key chosen for each semantic group; accidental groups are
 * left untouched. The canonical key is the first key (sorted) in the group,
 * placed in the namespace of that key. If a semantic group spans multiple
 * namespaces, the canonical key moves to `common`.
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  NAMESPACES,
  type Namespace,
  resolveNamespace,
  resolveNamespacedKey,
} from "./namespace-map.ts";

const REPO_ROOT = new URL("../../..", import.meta.url).pathname;
const MESSAGES_DIR = join(REPO_ROOT, "package/i18n/messages");
// Source-of-truth locale tree. App and admin Vite configs serve this at
// `/locales/*` via a small static middleware (see `package/i18n/src/vite.ts`).
const LOCALES_OUT = join(REPO_ROOT, "package/i18n/locales");
const KEY_MAP_PATH = join(REPO_ROOT, "tool/scripts/i18n/key-map.json");
const DEDUP_REPORT_PATH = join(REPO_ROOT, "tool/scripts/i18n/dedup-report.json");
const LOCALE_FILES = [
  "en.json",
  "de.json",
  "ja.json",
  "ko.json",
  "zh-hans.json",
  "zh-hant.json",
] as const;

type DedupGroup = {
  value: string;
  keys: string[];
  classification: "semantic" | "accidental";
};
type DedupReport = { groups: DedupGroup[] };

function pickCanonical(group: string[]): { ns: Namespace; key: string; flat: string } {
  const sorted = group.slice().sort();
  const namespaces = new Set(sorted.map((k) => resolveNamespace(k)));
  if (namespaces.size > 1) {
    // Cross-namespace semantic merge → promote to `common`. The canonical
    // key keeps the original full flat key to disambiguate.
    return { ns: "common", key: sorted[0], flat: sorted[0] };
  }
  const { ns, key } = resolveNamespacedKey(sorted[0]);
  return { ns, key, flat: sorted[0] };
}

async function main(): Promise<void> {
  const dedupRaw = await readFile(DEDUP_REPORT_PATH, "utf8").catch(() => "");
  const dedup: DedupReport = dedupRaw ? JSON.parse(dedupRaw) : { groups: [] };
  const semanticGroups = dedup.groups.filter((g) => g.classification === "semantic");

  // Build a key-rewrite map for semantic merges.
  // Map every member of a semantic group → the canonical {ns, key}.
  const semanticRewrite = new Map<string, { ns: Namespace; key: string }>();
  for (const g of semanticGroups) {
    const canonical = pickCanonical(g.keys);
    for (const k of g.keys) {
      semanticRewrite.set(k, { ns: canonical.ns, key: canonical.key });
    }
  }

  // Build the full key map: old flat key → "<ns>:<key>".
  const enRaw = await readFile(join(MESSAGES_DIR, "en.json"), "utf8");
  const en = JSON.parse(enRaw) as Record<string, string>;
  const keyMap: Record<string, string> = {};
  for (const flatKey of Object.keys(en)) {
    if (flatKey === "$schema") continue;
    const rewrite = semanticRewrite.get(flatKey);
    if (rewrite) {
      keyMap[flatKey] = `${rewrite.ns}:${rewrite.key}`;
    } else {
      const { ns, key } = resolveNamespacedKey(flatKey);
      keyMap[flatKey] = `${ns}:${key}`;
    }
  }

  await rm(LOCALES_OUT, { recursive: true, force: true });
  await mkdir(LOCALES_OUT, { recursive: true });

  let totalKeysWritten = 0;
  const perNamespaceCounts: Record<string, number> = {};

  for (const file of LOCALE_FILES) {
    const locale = file.replace(".json", "");
    const raw = await readFile(join(MESSAGES_DIR, file), "utf8");
    const flat = JSON.parse(raw) as Record<string, string>;

    const buckets: Record<Namespace, Record<string, string>> = Object.fromEntries(
      NAMESPACES.map((n) => [n, {} as Record<string, string>]),
    ) as Record<Namespace, Record<string, string>>;

    for (const [flatKey, value] of Object.entries(flat)) {
      if (flatKey === "$schema") continue;
      const target = keyMap[flatKey];
      if (!target) continue;
      const [ns, ...rest] = target.split(":");
      const key = rest.join(":");
      if (!buckets[ns as Namespace]) continue;
      // Last write wins for semantic-merge collisions (all members share value).
      buckets[ns as Namespace][key] = value;
    }

    const localeDir = join(LOCALES_OUT, locale);
    await mkdir(localeDir, { recursive: true });
    for (const ns of NAMESPACES) {
      const entries = buckets[ns];
      if (ns === "ui") continue; // ui ships bundled with @rezics/ui
      await writeFile(
        join(localeDir, `${ns}.json`),
        `${JSON.stringify(entries, null, 2)}\n`,
        "utf8",
      );
      if (locale === "en") {
        perNamespaceCounts[ns] = Object.keys(entries).length;
        totalKeysWritten += Object.keys(entries).length;
      }
    }
  }

  await writeFile(KEY_MAP_PATH, `${JSON.stringify(keyMap, null, 2)}\n`, "utf8");

  console.log(
    `i18n split: wrote ${totalKeysWritten} en keys across ${NAMESPACES.length - 1} namespaces × ${LOCALE_FILES.length} locales.`,
  );
  for (const ns of NAMESPACES) {
    if (ns === "ui") continue;
    console.log(`  ${ns.padEnd(10)} ${perNamespaceCounts[ns] ?? 0}`);
  }
}

if (import.meta.main) {
  await main();
}

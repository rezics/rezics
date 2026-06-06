import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  type AdminNavEntry,
  type AdminNavItem,
  adminNav,
} from "./adminNavConfig";

function flattenItems(entries: AdminNavEntry[]): AdminNavItem[] {
  return entries.flatMap((entry) =>
    "children" in entry ? entry.children : [entry],
  );
}

describe("adminNav config", () => {
  test("every route target is unique across the flattened tree", () => {
    // A nav whose entries can share a `to` is a list, not a map: it makes
    // "where does this route live" ambiguous and lets the same page accrete
    // under multiple groups. Keep every `to` owned by exactly one entry.
    const tos = flattenItems(adminNav.items).map((item) => item.to);
    const duplicates = tos.filter((to, index) => tos.indexOf(to) !== index);
    expect(duplicates).toEqual([]);
  });

  test("no label thunk hardcodes a display string", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./adminNavConfig.tsx", import.meta.url)),
      "utf-8",
    );
    const labelLines = source
      .split("\n")
      .filter((line) => /\blabel:\s*\(\)\s*=>/.test(line));
    expect(labelLines.length).toBeGreaterThan(0);

    // Every label/group title must resolve through i18n. After dropping the
    // i18n calls (template interpolations, which are code, and the literal key
    // args, which are not display text), the only literals tolerated are
    // punctuation separators between two calls (the " · " in the per-entity
    // Meili labels) — never a display word, which is what this guards against.
    const offenders = labelLines.filter((line) => {
      const body = line.slice(line.indexOf("=>") + 2);
      const withoutCalls = body
        .replace(/\$\{[^}]*\}/g, "")
        .replace(/\.t\(\s*["'][^"']*["']\s*\)/g, "");
      const literals = withoutCalls.match(/["'`]([^"'`]*)["'`]/g) ?? [];
      return literals.some((literal) => /\p{L}/u.test(literal.slice(1, -1)));
    });
    expect(offenders).toEqual([]);
  });
});

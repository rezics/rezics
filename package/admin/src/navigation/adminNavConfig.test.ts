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
    // 条目可以共享同一个 `to` 的导航是一个列表而非映射：它会使
    // “这个路由归属于何处”变得模糊，并让同一页面在多个分组下堆积。
    // 保持每个 `to` 恰好由一个条目拥有。
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
    // 每个 label/group title 都必须经由 i18n 解析。在剔除 i18n 调用之后
    //（模板插值属于代码，字面量 key 参数也不是展示文本），仅容许的字面量是
    // 两个调用之间的标点分隔符（per-entity Meili labels 中的 " · "）——
    // 绝不能是展示词，这正是此处所要防范的。
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

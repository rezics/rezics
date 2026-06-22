import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const appSrc = join(import.meta.dir, "../../package/app/src");
const serverSrc = join(import.meta.dir, "../../package/server/src");

function walk(dir: string): string[] {
  const entries: string[] = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, d.name);
    if (d.isDirectory()) entries.push(...walk(full));
    else if (/\.(tsx?)$/.test(d.name)) entries.push(full);
  }
  return entries;
}

const appFiles = walk(appSrc).filter(
  (f) =>
    !f.includes(".gen.") && !f.includes(".test.") && !f.includes("/shadcn/"),
);

const serverFiles = walk(serverSrc).filter(
  (f) =>
    !f.includes(".gen.") &&
    !f.includes(".test.") &&
    !f.includes("node_modules"),
);

describe("DX hygiene", () => {
  test("no raw clsx import in app code (use cn() from css-util)", () => {
    const raw = /from\s+["']clsx["']/;
    const violations: string[] = [];
    for (const file of appFiles) {
      if (file.endsWith("css-util.ts")) continue;
      const src = readFileSync(file, "utf-8");
      if (raw.test(src)) violations.push(file.replace(appSrc, "app/src"));
    }
    expect(violations).toEqual([]);
  });

  test("useDebouncedValue has single canonical source in shared/hooks", () => {
    const fnDef = /^export function useDebouncedValue/m;
    const sources: string[] = [];
    for (const file of appFiles) {
      const src = readFileSync(file, "utf-8");
      if (fnDef.test(src)) sources.push(file.replace(appSrc, "app/src"));
    }
    expect(sources).toEqual(["app/src/shared/hooks/useDebouncedValue.ts"]);
  });

  test("no inline useDebouncedValue reimplementations", () => {
    // Detect the pattern: function useDebouncedValue (non-exported)
    const inlineDef = /^function useDebouncedValue/m;
    const violations: string[] = [];
    for (const file of appFiles) {
      const src = readFileSync(file, "utf-8");
      if (inlineDef.test(src)) violations.push(file.replace(appSrc, "app/src"));
    }
    expect(violations).toEqual([]);
  });

  test("no client-side role filtering on member list queries", () => {
    // Member role filtering must use the server-side `roles` query param,
    // not client-side .filter() on roleKey after fetch.
    // 成员角色过滤必须使用服务端 roles 查询参数，禁止 fetch 后客户端 .filter()。
    const pattern = /\.filter\([^)]*roleKey/;
    const violations: string[] = [];
    for (const file of appFiles) {
      const src = readFileSync(file, "utf-8");
      if (pattern.test(src)) violations.push(file.replace(appSrc, "app/src"));
    }
    expect(violations).toEqual([]);
  });

  test("no bare enum string literals in === / !== comparisons", () => {
    // Contract enums (UnitType, UnitStatus, UnitVisibility, PostKind) must be
    // referenced via the constant, not as bare string literals.
    // 契约枚举必须通过常量引用，禁止裸字符串字面量比较。
    const enumValues = [
      "BOOK", "GAME", "MEDIA", "POST", "SHELF", "REALM", "ZONE",
      "ENTITY", "TAG", "USER",
      "DRAFT", "PUBLISHED", "ARCHIVED",
      "PUBLIC", "UNLISTED", "PRIVATE",
      "REVIEW", "REMARK", "EXCERPT", "CHAPTER", "WIKI",
    ];
    const pattern = new RegExp(
      `[!=]==\\s*"(${enumValues.join("|")})"`,
    );
    const violations: string[] = [];
    for (const file of appFiles) {
      const src = readFileSync(file, "utf-8");
      if (pattern.test(src)) violations.push(file.replace(appSrc, "app/src"));
    }
    expect(violations).toEqual([]);
  });

  test("no debug console.log in server meili API files", () => {
    const meiliDir = join(serverSrc, "meili");
    const meiliFiles = walk(meiliDir).filter((f) => f.endsWith(".api.ts"));
    const violations: string[] = [];
    for (const file of meiliFiles) {
      const src = readFileSync(file, "utf-8");
      if (/console\.log\(/.test(src))
        violations.push(file.replace(serverSrc, "server/src"));
    }
    expect(violations).toEqual([]);
  });
});

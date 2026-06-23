import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

// Files verified free of `as unknown as` — regressions are forbidden.
// 已验证不含 `as unknown as` 的文件——禁止回归。
const CLEAN_SERVER_FILES = [
  "jwt/jwtServiceRepository.ts",
  "game-system-requirement/mapper.ts",
  "middleware/permission.ts",
];

const CLEAN_APP_FILES = ["book-library/hooks/useBookLanguage.ts"];

// Server API files that must not use `as any` in hasPermission* calls.
// hasPermission* 调用处禁止使用 `as any` 强转的 server API 文件列表。
const PERMISSION_CALL_API_FILES = [
  "unit/unit.api.ts",
  "realm/realm.api.ts",
  "chapter/chapter.api.ts",
  "book/book.api.ts",
];

const serverSrc = join(import.meta.dir, "../../package/server/src");
const appSrc = join(import.meta.dir, "../../package/app/src");

describe("no unsafe `as unknown as` casts", () => {
  test("cleaned server files stay cast-free", () => {
    const violations: string[] = [];
    for (const rel of CLEAN_SERVER_FILES) {
      const content = readFileSync(join(serverSrc, rel), "utf-8");
      const codeLines = content
        .split("\n")
        .filter((l) => !l.trimStart().startsWith("//"));
      if (codeLines.some((l) => l.includes("as unknown as"))) {
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });

  test("cleaned app files stay cast-free", () => {
    const violations: string[] = [];
    for (const rel of CLEAN_APP_FILES) {
      const content = readFileSync(join(appSrc, rel), "utf-8");
      const codeLines = content
        .split("\n")
        .filter((l) => !l.trimStart().startsWith("//"));
      if (codeLines.some((l) => l.includes("as unknown as"))) {
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });

  test("hasPermission* call sites: no `as any` argument casts", () => {
    // Scans each API file for any `as any` that appears within 10 lines of a
    // hasPermission* call — the structural UnitOwnershipRef type must make
    // casts unnecessary.
    // 扫描每个 API 文件：hasPermission* 调用后 10 行内不得出现 `as any`——
    // 结构化的 UnitOwnershipRef 类型应使强转多余。
    const violations: string[] = [];
    for (const rel of PERMISSION_CALL_API_FILES) {
      const src = readFileSync(join(serverSrc, rel), "utf-8");
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === undefined) continue;
        if (line.includes("hasPermission")) {
          for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
            const nearby = lines[j];
            if (nearby === undefined) continue;
            if (nearby.includes("as any")) {
              violations.push(`${rel}:${j + 1}: ${nearby.trim()}`);
            }
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test("typed Drizzle JSON columns use .$type<>()", () => {
    const schemaDir = join(serverSrc, "db/schema");
    const checks = [
      {
        file: "jwt.ts",
        columns: ["publicJwk", "privateJwk"],
      },
      {
        file: "game.ts",
        columns: ["hardware"],
      },
    ];

    const missing: string[] = [];
    for (const { file, columns } of checks) {
      const content = readFileSync(join(schemaDir, file), "utf-8");
      for (const col of columns) {
        // ponytail: match `columnName: jsonData<SomeType>()` — the generic
        // parameter is what proves the column is typed
        // ponytail: 匹配 `columnName: jsonData<SomeType>()` — 泛型参数证明列已类型化
        const pattern = new RegExp(`${col}:\\s*jsonData<(?!unknown)[A-Z]\\w*`);
        if (!pattern.test(content)) {
          missing.push(`${file}:${col}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

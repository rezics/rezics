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
        const pattern = new RegExp(
          `${col}:\\s*jsonData<(?!unknown)[A-Z]\\w*`,
        );
        if (!pattern.test(content)) {
          missing.push(`${file}:${col}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

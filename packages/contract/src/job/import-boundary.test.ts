import { describe, expect, test } from "bun:test";

const FORBIDDEN_PATTERNS = [
  /from\s+["']pg-boss["']/,
  /from\s+["']meilisearch["']/,
  /from\s+["']@prisma\/client["']/,
  /from\s+["'][^"']*\/env["']/,
  /from\s+["']@rezics\/server/,
  /from\s+["']@rezics\/search/,
];

async function collectSourceFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  for await (const entry of new Bun.Glob("**/*.ts").scan({ cwd: dir })) {
    if (entry.endsWith(".test.ts")) continue;
    files.push(`${dir}/${entry}`);
  }
  return files;
}

describe("@rezics/contract/job import boundary", () => {
  test("does not import runtime queue, app, Prisma, Meili, or env modules", async () => {
    const files = await collectSourceFiles(import.meta.dir);
    const violations: string[] = [];

    for (const file of files) {
      const text = await Bun.file(file).text();
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(text)) violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });
});

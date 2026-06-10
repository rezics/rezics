import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { scanJsonPolicyForTest } from "../src/commands/convention/rules";

function tempSchema(source: string): string {
  const dir = mkdtempSync(join(tmpdir(), "rezics-json-policy-"));
  const path = join(dir, "schema.ts");
  writeFileSync(path, source);
  return path;
}

describe("JSON column policy convention", () => {
  test("rejects unregistered persisted JSON columns", () => {
    const schemaPath = tempSchema(`
      import { pgTable } from "drizzle-orm/pg-core";
      import { jsonData } from "./columns";

      export const NewTable = pgTable("NewTable", {
        payload: jsonData().notNull(),
      });
    `);

    expect(
      scanJsonPolicyForTest({ schemaFiles: [schemaPath] }).map(
        (violation) => violation.rule,
      ),
    ).toContain("R15");
  });

  test("rejects server-side in-database JSON mutation helpers", () => {
    const sourcePath = tempSchema(`
      export function mutate() {
        return sql\`jsonb_set(payload, '{x}', '"y"')\`;
      }
    `);

    expect(
      scanJsonPolicyForTest({
        schemaFiles: [],
        tsAndTsxFiles: [sourcePath],
      }).map((violation) => violation.rule),
    ).toContain("R15");
  });
});

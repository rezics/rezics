import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  renderCreateDatabaseSql,
  repoDatabaseNames,
} from "./repo-database-registry";

describe("repo database registry", () => {
  test("owns the managed local database names", () => {
    expect(repoDatabaseNames()).toContain("rezics_reaction");
    expect(repoDatabaseNames()).not.toContain("reaction");
  });

  test("keeps Docker bootstrap SQL derived from the registry", () => {
    const sqlPath = join(
      import.meta.dir,
      "dev-external-services/source-postgres/init/001-create-databases.sql",
    );

    expect(readFileSync(sqlPath, "utf8")).toBe(renderCreateDatabaseSql());
  });
});

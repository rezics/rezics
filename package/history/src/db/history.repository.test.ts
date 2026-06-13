import { describe, expect, test } from "bun:test";
import { SQL } from "drizzle-orm";

process.env.HISTORY_DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_history";
process.env.SERVER_DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_server";
process.env.HISTORY_INTERNAL_SECRET ??= "test-secret";

describe("revisionPathJsonbValue", () => {
  test("stores null path leaves as JSON null instead of SQL NULL", async () => {
    const { revisionPathJsonbValue } = await import("./history.repository");

    expect(revisionPathJsonbValue(null)).toBeInstanceOf(SQL);
  });

  test("leaves non-null path values unchanged", async () => {
    const { revisionPathJsonbValue } = await import("./history.repository");
    const objectValue = { type: "markdown", source: "Body" };

    expect(revisionPathJsonbValue("Title")).toBe("Title");
    expect(revisionPathJsonbValue(1)).toBe(1);
    expect(revisionPathJsonbValue(objectValue)).toBe(objectValue);
  });
});

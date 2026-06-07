import { describe, expect, test } from "bun:test";

import { readDatabaseErrorDetails } from "./database-error";

describe("readDatabaseErrorDetails", () => {
  test("unwraps Drizzle cause metadata", () => {
    const wrapped = Object.assign(new Error("Failed query"), {
      cause: {
        code: "23502",
        table: "Post",
        column: "updatedAt",
        constraint: "Post_updatedAt_not_null",
      },
    });

    expect(readDatabaseErrorDetails(wrapped)).toEqual({
      code: "23502",
      table: "Post",
      column: "updatedAt",
      constraint: "Post_updatedAt_not_null",
    });
  });

  test.each([
    "23502",
    "23503",
    "23505",
    "23514",
    "22P02",
  ])("reads %s from direct PostgreSQL errors", (code) => {
    expect(readDatabaseErrorDetails({ code })).toEqual({ code });
  });
});

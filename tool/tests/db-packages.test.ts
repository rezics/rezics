import { describe, expect, test } from "bun:test";
import {
  DB_MIGRATION_ORDER,
  resolveDbSchemaPackages,
} from "../src/commands/db/packages";

describe("db package registry", () => {
  test("defaults to the proposal migration order", () => {
    expect(resolveDbSchemaPackages([]).packages).toEqual([
      ...DB_MIGRATION_ORDER,
    ]);
  });

  test("orders selected packages by migration order", () => {
    expect(
      resolveDbSchemaPackages(["ranking", "reaction", "auth"]).packages,
    ).toEqual(["auth", "reaction", "ranking"]);
  });

  test("separates ensure-only and unknown packages", () => {
    expect(resolveDbSchemaPackages(["job-runner", "nope"])).toEqual({
      packages: [],
      unknown: ["nope"],
      ensureOnly: ["job-runner"],
    });
  });
});

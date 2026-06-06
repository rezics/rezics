import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { ROUTED_SEQUIN_TABLES } from "@rezics/job";

function yamlIncludedTables() {
  const yaml = readFileSync(
    join(import.meta.dir, "../../sequin/sequin.yml"),
    "utf8",
  );
  return Array.from(
    yaml.matchAll(/-\s+public\.([A-Za-z0-9_]+)/g),
    (match) => match[1]!,
  ).sort();
}

describe("Sequin routed table manifest", () => {
  test("matches checked-in Sequin include_tables", () => {
    expect(yamlIncludedTables()).toEqual([...ROUTED_SEQUIN_TABLES].sort());
  });
});

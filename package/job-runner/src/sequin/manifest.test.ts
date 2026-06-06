import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  REACTION_SEQUIN_TABLES,
  ROUTED_SEQUIN_TABLES,
  SOURCE_SEQUIN_TABLES,
} from "@rezics/job";

const yaml = readFileSync(
  join(import.meta.dir, "../../sequin/sequin.yml"),
  "utf8",
);

function yamlIncludedTables() {
  return Array.from(
    yaml.matchAll(/-\s+public\.([A-Za-z0-9_]+)/g),
    (match) => match[1]!,
  ).sort();
}

function yamlIncludedTablesForSink(sinkName: string) {
  const marker = `  - name: ${sinkName}`;
  const start = yaml.indexOf(marker);
  if (start === -1) throw new Error(`Missing sink ${sinkName}`);
  const next = yaml.indexOf("\n\n  - name:", start + marker.length);
  const section = yaml.slice(start, next === -1 ? undefined : next);
  return Array.from(
    section.matchAll(/-\s+public\.([A-Za-z0-9_]+)/g),
    (match) => match[1]!,
  ).sort();
}

function sourcePublicationTables() {
  const publication = yaml.match(
    /CREATE PUBLICATION rezics_sequin_pub_\$\{ENV:-development\}[\s\S]*?;/,
  )?.[0];
  if (!publication) throw new Error("Missing source publication init_sql");
  return Array.from(
    publication.matchAll(/public\."([A-Za-z0-9_]+)"/g),
    (match) => match[1]!,
  ).sort();
}

describe("Sequin routed table manifest", () => {
  test("matches checked-in Sequin include_tables", () => {
    expect(yamlIncludedTables()).toEqual([...ROUTED_SEQUIN_TABLES].sort());
  });

  test("matches checked-in source publication tables", () => {
    expect(sourcePublicationTables()).toEqual([...SOURCE_SEQUIN_TABLES].sort());
  });

  test("keeps source and reaction sink tables scoped to their databases", () => {
    expect(yamlIncludedTablesForSink("rezics-job-runner-webhook")).toEqual(
      [...SOURCE_SEQUIN_TABLES].sort(),
    );
    expect(
      yamlIncludedTablesForSink("rezics-reaction-job-runner-webhook"),
    ).toEqual([...REACTION_SEQUIN_TABLES].sort());
  });
});

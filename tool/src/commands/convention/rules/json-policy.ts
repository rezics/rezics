import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { REPO_ROOT } from "../core/paths";
import type { RuleScanner, Violation } from "../core/types";
import { jsonColumnRegistry } from "./json-policy-registry";

const SPEC =
  "R15 — persisted JSON columns must be explicitly classified and must not be mutated in-database";

type JsonColumn = {
  database: "server" | "auth";
  table: string;
  column: string;
  path: string;
  line: number;
};

const JSON_COLUMN_PATTERN =
  /^\s*([A-Za-z_$][\w$]*)\s*:\s*.*(?:jsonData\(\)|\.jsonb\()/;
const JSON_MUTATION_PATTERN = /\b(jsonb_set|jsonb_insert|jsonb_path_set)\b/;

function registryKey(column: {
  database: string;
  table: string;
  column: string;
}): string {
  return `${column.database}.${column.table}.${column.column}`;
}

function toRepoPath(absPath: string): string {
  return relative(REPO_ROOT, absPath).replace(/\\/g, "/");
}

function readRepoFile(relPath: string): string | null {
  const absPath = join(REPO_ROOT, relPath);
  if (!existsSync(absPath)) return null;
  return readFileSync(absPath, "utf8");
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function collectJsonColumns(schemaFiles: string[]): JsonColumn[] {
  const columns: JsonColumn[] = [];

  for (const absPath of schemaFiles) {
    const relPath = toRepoPath(absPath);
    const database = relPath.startsWith("packages/backend/src/services/auth/") ? "auth" : "server";
    let content: string;
    try {
      content = readFileSync(absPath, "utf8");
    } catch {
      continue;
    }

    let tableName: string | null = null;
    let awaitingTableName = false;
    const lines = content.split("\n");
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index]!;
      if (line.includes("pgTable(")) awaitingTableName = true;
      if (awaitingTableName) {
        const tableMatch = line.match(/"([^"]+)"/);
        if (tableMatch?.[1]) {
          tableName = tableMatch[1];
          awaitingTableName = false;
        }
      }

      const columnMatch = line.match(JSON_COLUMN_PATTERN);
      if (tableName && columnMatch?.[1]) {
        columns.push({
          database,
          table: tableName,
          column: columnMatch[1],
          path: relPath,
          line: index + 1,
        });
      }
    }
  }

  return columns;
}

function checkEnvelopeSchema(entry: (typeof jsonColumnRegistry)[number]) {
  if (entry.category !== "enveloped") return [];
  const sources = [
    entry.contractSchema.path,
    ...(entry.contractSchema.supportingPaths ?? []),
  ]
    .map(readRepoFile)
    .filter((source): source is string => source !== null)
    .join("\n");

  const failures: string[] = [];
  if (!sources.includes(`export const ${entry.contractSchema.symbol}`)) {
    failures.push(`missing exported schema ${entry.contractSchema.symbol}`);
  }
  if (
    !new RegExp(`${entry.contractSchema.symbol}\\s*=\\s*t\\.Union`).test(
      sources,
    )
  ) {
    failures.push("schema is not declared as a t.Union");
  }
  if (!/schema\s*:\s*t\.Literal\(/.test(sources)) {
    failures.push("union members do not declare literal schema metadata");
  }
  if (!/version\s*:\s*t\.Literal\(/.test(sources)) {
    failures.push("union members do not declare literal version metadata");
  }
  return failures;
}

function checkCompatSchema(entry: (typeof jsonColumnRegistry)[number]) {
  if (entry.category !== "compat") return [];
  const source = readRepoFile(entry.contractSchema.path);
  const failures: string[] = [];
  if (!source) {
    return [`missing schema file ${entry.contractSchema.path}`];
  }
  const code = stripComments(source);
  if (!source.includes("@compat additive-only")) {
    failures.push("compat schema JSDoc must include @compat additive-only");
  }
  if (/additionalProperties\s*:\s*false/.test(code)) {
    failures.push(
      "additive-compatible schemas must not use additionalProperties: false",
    );
  }
  if (/t\.Union\([\s\S]*(?:kind|type)\s*:\s*t\.Literal\(/.test(code)) {
    const hasUnknownFallback =
      /(?:kind|type)\s*:\s*t\.String\(\)/.test(code) ||
      /unknown\w*Schema/i.test(code);
    if (!hasUnknownFallback) {
      failures.push(
        "closed discriminated unions need an unknown-kind fallback branch",
      );
    }
  }
  return failures;
}

export const jsonPolicyRule: RuleScanner = {
  scan({ schemaFiles, tsAndTsxFiles }) {
    const violations: Violation[] = [];
    const registry = new Map(
      jsonColumnRegistry.map((entry) => [registryKey(entry), entry]),
    );

    for (const column of collectJsonColumns(schemaFiles)) {
      if (!registry.has(registryKey(column))) {
        violations.push({
          rule: "R15",
          path: `${column.path}:${column.line}`,
          message: `JSON column ${registryKey(column)} is missing from jsonColumnRegistry.`,
          spec: SPEC,
        });
      }
    }

    for (const entry of jsonColumnRegistry) {
      if (entry.category === "exempt" && entry.reason.trim().length === 0) {
        violations.push({
          rule: "R15",
          path: "tool/src/commands/convention/rules/json-policy-registry.ts",
          message: `${registryKey(entry)} is exempt but has no reason.`,
          spec: SPEC,
        });
      }

      const schemaFailures = [
        ...checkEnvelopeSchema(entry),
        ...checkCompatSchema(entry),
      ];
      for (const failure of schemaFailures) {
        violations.push({
          rule: "R15",
          path:
            entry.category === "exempt"
              ? "tool/src/commands/convention/rules/json-policy-registry.ts"
              : entry.contractSchema.path,
          message: `${registryKey(entry)}: ${failure}.`,
          spec: SPEC,
        });
      }
    }

    for (const absPath of tsAndTsxFiles) {
      const relPath = toRepoPath(absPath);
      if (
        !relPath.startsWith("..") &&
        !/^packages\/backend\/src\//.test(relPath)
      ) {
        continue;
      }
      let content: string;
      try {
        content = readFileSync(absPath, "utf8");
      } catch {
        continue;
      }
      const lines = content.split("\n");
      for (let index = 0; index < lines.length; index++) {
        const match = lines[index]!.match(JSON_MUTATION_PATTERN);
        if (!match) continue;
        violations.push({
          rule: "R15",
          path: `${relPath}:${index + 1}`,
          message: `Forbidden in-database JSON mutation helper \`${match[1]}\`; use parse -> upgrade -> mutate -> validate -> persist.`,
          spec: SPEC,
        });
      }
    }

    return violations;
  },
};

export function scanJsonPolicyForTest(options: {
  schemaFiles: string[];
  tsAndTsxFiles?: string[];
}): Violation[] {
  return jsonPolicyRule.scan({
    apiFiles: [],
    tsxFiles: [],
    tsAndTsxFiles: options.tsAndTsxFiles ?? [],
    schemaFiles: options.schemaFiles,
    r9CandidateFiles: [],
    folderPaths: [],
  });
}

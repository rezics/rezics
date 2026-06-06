import pg from "pg";
import { repeatedCsv } from "../../cli/values";
import { type DbSchemaPackage, resolveDbSchemaPackages } from "./packages";
import {
  type DbPreflightClient,
  resolveDbConnectionUrl,
  runDbPreflightChecks,
} from "./preflight";

interface SmokeCliFlags {
  packages: string[];
}

const PACKAGE_TABLES = {
  auth: ["User", "Session", "Account", "Verification", "JwtService"],
  server: [
    "Unit",
    "Comment",
    "PollVote",
    "Subscription",
    "EmailVerificationContract",
  ],
  notify: ["Notification", "Conversation", "Message", "ConversationBlock"],
  reaction: ["Reaction", "ReactionSummary", "ReactionTargetUsage"],
  history: ["RevisionContent", "UnitRevision", "UnitRevisionPath"],
  ranking: [
    "UnitRankProjection",
    "RankingSignalBucket",
    "RankingFormulaVersion",
    "ServingPatchStatus",
  ],
} as const satisfies Record<DbSchemaPackage, readonly string[]>;

const SERVER_INDEXES = [
  "Comment_rootUnitId_realmUnitId_parentCommentId_createdAt_id_idx",
  "PollVote_single_choice_uniq",
  "subscription_channels_gin",
] as const;

function parseArgs(argv: string[]): SmokeCliFlags {
  const packages: string[] = [];

  for (const arg of argv) {
    if (arg.startsWith("--package=")) {
      packages.push(...repeatedCsv(arg.slice("--package=".length)));
    }
  }

  return { packages };
}

async function runScalar<T>(
  client: DbPreflightClient,
  query: string,
  column: string,
): Promise<T> {
  const result = await client.query(query);
  return result.rows[0]?.[column] as T;
}

async function assertTableExists(
  client: DbPreflightClient,
  pkg: DbSchemaPackage,
  tableName: string,
): Promise<void> {
  const exists = await runScalar<boolean>(
    client,
    `SELECT to_regclass('public."${tableName}"') IS NOT NULL AS exists`,
    "exists",
  );
  if (exists !== true) {
    throw new Error(
      `@rezics/${pkg} migration smoke failed: missing table ${tableName}.`,
    );
  }
}

async function assertServerUuidv7Extraction(client: DbPreflightClient) {
  const version = await runScalar<number | string>(
    client,
    "SELECT uuid_extract_version(uuidv7()) AS version",
    "version",
  );
  if (Number(version) !== 7) {
    throw new Error(
      `@rezics/server migration smoke failed: uuidv7() did not extract version 7; got ${version}.`,
    );
  }
}

async function assertServerEnumValues(client: DbPreflightClient) {
  const values = await runScalar<string>(
    client,
    `SELECT array_to_string(enum_range(NULL::"PostKind"), ',') AS values`,
    "values",
  );
  if (values !== "REVIEW,EXCERPT,REMARK,POST,CHAPTER,WIKI") {
    throw new Error(
      `@rezics/server migration smoke failed: unexpected PostKind values ${values}.`,
    );
  }
}

async function assertServerIndex(
  client: DbPreflightClient,
  indexName: string,
): Promise<void> {
  const exists = await runScalar<boolean>(
    client,
    `SELECT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = '${indexName}'
    ) AS exists`,
    "exists",
  );
  if (exists !== true) {
    throw new Error(
      `@rezics/server migration smoke failed: missing index ${indexName}.`,
    );
  }
}

export async function runDbSmokeChecks(
  client: DbPreflightClient,
  pkg: DbSchemaPackage,
): Promise<void> {
  await runDbPreflightChecks(client, pkg, "afterMigration");

  for (const tableName of PACKAGE_TABLES[pkg]) {
    await assertTableExists(client, pkg, tableName);
  }

  if (pkg === "server") {
    await assertServerUuidv7Extraction(client);
    await assertServerEnumValues(client);
    for (const indexName of SERVER_INDEXES) {
      await assertServerIndex(client, indexName);
    }
  }
}

async function smokePackage(pkg: DbSchemaPackage): Promise<void> {
  const url = resolveDbConnectionUrl(pkg);
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    await runDbSmokeChecks(client, pkg);
    console.log(`ok @rezics/${pkg} migration smoke`);
  } finally {
    await client.end().catch(() => {});
  }
}

export async function smokeDatabases(argv = Bun.argv.slice(2)): Promise<void> {
  const flags = parseArgs(argv);
  const selection = resolveDbSchemaPackages(flags.packages);

  if (selection.unknown.length > 0) {
    throw new Error(
      `Unknown database package(s): ${selection.unknown.join(", ")}`,
    );
  }
  if (selection.ensureOnly.length > 0) {
    throw new Error(
      `Package(s) are ensure-only and do not own Drizzle schemas: ${selection.ensureOnly.join(", ")}`,
    );
  }

  for (const pkg of selection.packages) {
    await smokePackage(pkg);
  }
}

if (import.meta.main) {
  await smokeDatabases();
}

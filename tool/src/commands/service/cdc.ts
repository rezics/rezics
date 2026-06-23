import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { Client } from "pg";
import {
  REACTION_SEQUIN_TABLES,
  SOURCE_SEQUIN_TABLES,
} from "../../../../package/job/src/sequin/manifest";

const TOOL_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const REPO_ROOT = path.resolve(TOOL_DIR, "..");

loadDotenv({ path: path.join(TOOL_DIR, ".env"), override: false, quiet: true });
loadDotenv({
  path: path.join(REPO_ROOT, "packages/backend/.env"),
  override: false,
  quiet: true,
});

type SourceId = "source" | "reaction";

type Args = {
  apply: boolean;
  devReset: boolean;
  forceActiveSlot: boolean;
  help: boolean;
  source?: SourceId;
  sourceUrl?: string;
  reactionUrl?: string;
};

type PgSetting = {
  name: string;
  setting: string;
  pending_restart: boolean;
};

type CdcSource = {
  id: SourceId;
  label: string;
  urlArg?: string;
  databaseEnvPrefix: "SOURCE" | "REACTION";
  defaultDatabase: string;
  publicationName: string;
  slotName: string;
  trackedTables: readonly string[];
};

function parseSource(value: string): SourceId {
  if (value === "source" || value === "reaction") return value;
  throw new Error("--source must be one of: source, reaction");
}

function parseArgs(argv: string[]): Args {
  const sourceArg = argv.find((arg) => arg.startsWith("--source="));
  const sourceUrlArg = argv.find((arg) => arg.startsWith("--source-url="));
  const reactionUrlArg = argv.find((arg) => arg.startsWith("--reaction-url="));
  return {
    apply: argv.includes("--apply"),
    devReset: argv.includes("--dev-reset"),
    forceActiveSlot: argv.includes("--force-active-slot"),
    help: argv.includes("--help") || argv.includes("-h"),
    source: sourceArg
      ? parseSource(sourceArg.slice("--source=".length))
      : undefined,
    sourceUrl: sourceUrlArg?.slice("--source-url=".length),
    reactionUrl: reactionUrlArg?.slice("--reaction-url=".length),
  };
}

function usage(): never {
  console.log(
    [
      "Usage:",
      "  bun run service cdc verify [--source=source|reaction] [--source-url=postgresql://...] [--reaction-url=postgresql://...]",
      "  bun run service cdc repair [--source=source|reaction] [--source-url=postgresql://...] [--reaction-url=postgresql://...] [--force-active-slot]",
      "  bun run service cdc recover [--source=source|reaction] [--force-active-slot]",
      "",
      "Legacy direct usage:",
      "  bun run tool/src/commands/service/cdc.ts [--apply --dev-reset] [--source=source|reaction] [--force-active-slot]",
      "",
      "Checks every Sequin CDC source database used by local managed services.",
      "",
      "Verification mode is read-only.",
      "Repair mode is a low-level local source-object repair. Prefer `service cdc recover` for normal local recovery.",
      "Repair mode is local-development scoped and runs with --apply --dev-reset to:",
      "  - ALTER SYSTEM wal_level=logical",
      "  - ensure max_replication_slots/max_wal_senders",
      "  - recreate source-specific publications",
      "  - recreate source-specific logical replication slots when wal_level is already logical",
      "",
      "If wal_level changes, restart Postgres and run this script again.",
    ].join("\n"),
  );
  process.exit(0);
}

function envValue(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function envSuffix() {
  return envValue("ENV", "development");
}

function cdcSources(args: Args): CdcSource[] {
  const suffix = envSuffix();
  const sources: CdcSource[] = [
    {
      id: "source",
      label: "Server source DB",
      urlArg: args.sourceUrl,
      databaseEnvPrefix: "SOURCE",
      defaultDatabase: "rezics_server",
      publicationName: `rezics_sequin_pub_${suffix}`,
      slotName: `rezics_sequin_slot_${suffix}`,
      trackedTables: SOURCE_SEQUIN_TABLES,
    },
    {
      id: "reaction",
      label: "Reaction source DB",
      urlArg: args.reactionUrl,
      databaseEnvPrefix: "REACTION",
      defaultDatabase: "rezics_reaction",
      publicationName: `rezics_reaction_sequin_pub_${suffix}`,
      slotName: `rezics_reaction_sequin_slot_${suffix}`,
      trackedTables: REACTION_SEQUIN_TABLES,
    },
  ];
  return args.source
    ? sources.filter((source) => source.id === args.source)
    : sources;
}

function connectionConfig(source: CdcSource) {
  if (source.urlArg) return { connectionString: source.urlArg };
  if (source.id === "source" && process.env.SERVER_DATABASE_URL) {
    return { connectionString: process.env.SERVER_DATABASE_URL };
  }

  const prefix = source.databaseEnvPrefix;
  return {
    host: envValue(`${prefix}_DB_HOST`, "localhost"),
    port: Number(envValue(`${prefix}_DB_PORT`, "5432")),
    database: envValue(`${prefix}_DB_NAME`, source.defaultDatabase),
    user: envValue(`${prefix}_DB_USER`, "postgres"),
    password: envValue(`${prefix}_DB_PASSWORD`),
  };
}

function redactUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  const auth = url.username ? "<user>:<pass>@" : "";
  return `${url.protocol}//${auth}${url.host}${url.pathname}${url.search}`;
}

function connectionLabel(source: CdcSource) {
  const config = connectionConfig(source);
  if (
    "connectionString" in config &&
    typeof config.connectionString === "string"
  ) {
    return redactUrl(config.connectionString);
  }
  return `${config.user}@${config.host}:${config.port}/${config.database}`;
}

function quoteIdent(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function qualifiedTable(table: string) {
  return `public.${quoteIdent(table)}`;
}

function requiredTableListSql(source: CdcSource) {
  return source.trackedTables.map(qualifiedTable).join(",\n      ");
}

function ok(label: string) {
  console.log(`ok    ${label}`);
}

function warn(label: string) {
  console.log(`warn  ${label}`);
}

function fail(label: string) {
  console.log(`fail  ${label}`);
}

async function currentSettings(
  client: Client,
): Promise<Map<string, PgSetting>> {
  const result = await client.query<PgSetting>(
    `
      SELECT name, setting, pending_restart
      FROM pg_settings
      WHERE name IN ('wal_level', 'max_replication_slots', 'max_wal_senders')
      ORDER BY name
    `,
  );
  return new Map(result.rows.map((row) => [row.name, row]));
}

function settingNumber(settings: Map<string, PgSetting>, name: string) {
  return Number(settings.get(name)?.setting ?? 0);
}

async function ensureSettings(client: Client, args: Args) {
  const settings = await currentSettings(client);
  const walLevel = settings.get("wal_level");
  const maxSlots = settingNumber(settings, "max_replication_slots");
  const maxSenders = settingNumber(settings, "max_wal_senders");

  if (walLevel?.setting === "logical") {
    ok("wal_level is logical");
  } else {
    fail(`wal_level is ${walLevel?.setting ?? "<missing>"}; expected logical`);
    if (args.apply) {
      await client.query("ALTER SYSTEM SET wal_level = 'logical'");
      warn(
        "set wal_level=logical with ALTER SYSTEM; restart Postgres required",
      );
    }
  }

  if (maxSlots >= 10) {
    ok(`max_replication_slots is ${maxSlots}`);
  } else {
    fail(`max_replication_slots is ${maxSlots}; expected >= 10`);
    if (args.apply) {
      await client.query("ALTER SYSTEM SET max_replication_slots = '10'");
      warn("set max_replication_slots=10 with ALTER SYSTEM");
    }
  }

  if (maxSenders >= 10) {
    ok(`max_wal_senders is ${maxSenders}`);
  } else {
    fail(`max_wal_senders is ${maxSenders}; expected >= 10`);
    if (args.apply) {
      await client.query("ALTER SYSTEM SET max_wal_senders = '10'");
      warn("set max_wal_senders=10 with ALTER SYSTEM");
    }
  }

  if (args.apply) {
    await client.query("SELECT pg_reload_conf()");
  }

  const refreshed = await currentSettings(client);
  const pendingRestart = [...refreshed.values()].filter(
    (setting) => setting.pending_restart,
  );
  if (pendingRestart.length > 0) {
    warn(
      `Postgres restart pending for: ${pendingRestart
        .map((setting) => setting.name)
        .join(", ")}`,
    );
  }

  return refreshed;
}

async function assertTrackedTablesExist(client: Client, source: CdcSource) {
  const result = await client.query<{ table_name: string }>(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      ORDER BY table_name
    `,
    [source.trackedTables],
  );
  const existing = new Set(result.rows.map((row) => row.table_name));
  const missing = source.trackedTables.filter((table) => !existing.has(table));
  if (missing.length > 0) {
    throw new Error(
      `${source.id}: missing tracked table(s): ${missing.join(", ")}`,
    );
  }
  ok(`${source.id}: tracked tables exist (${source.trackedTables.length})`);
}

async function ensurePublication(
  client: Client,
  args: Args,
  source: CdcSource,
) {
  const pub = source.publicationName;
  const existing = await client.query<{ pubname: string }>(
    "SELECT pubname FROM pg_publication WHERE pubname = $1",
    [pub],
  );

  if (args.apply && args.devReset && (existing.rowCount ?? 0) > 0) {
    await client.query(`DROP PUBLICATION ${quoteIdent(pub)}`);
    warn(`${source.id}: dropped existing publication ${pub}`);
  }

  if (args.apply && (args.devReset || (existing.rowCount ?? 0) === 0)) {
    await client.query(
      `
        CREATE PUBLICATION ${quoteIdent(pub)}
        FOR TABLE
          ${requiredTableListSql(source)}
      `,
    );
    ok(`${source.id}: created publication ${pub}`);
  }

  const tables = await client.query<{ tablename: string }>(
    `
      SELECT tablename
      FROM pg_publication_tables
      WHERE pubname = $1
        AND schemaname = 'public'
      ORDER BY tablename
    `,
    [pub],
  );
  const published = new Set(tables.rows.map((row) => row.tablename));
  const missing = source.trackedTables.filter((table) => !published.has(table));
  const extra = tables.rows
    .map((row) => row.tablename)
    .filter((table) => !source.trackedTables.includes(table));

  if (missing.length === 0 && extra.length === 0) {
    ok(
      `${source.id}: publication ${pub} tracks exactly ${source.trackedTables.length} table(s)`,
    );
  } else {
    if (missing.length > 0) {
      fail(`${source.id}: publication ${pub} missing: ${missing.join(", ")}`);
    }
    if (extra.length > 0) {
      warn(
        `${source.id}: publication ${pub} has extra table(s): ${extra.join(", ")}`,
      );
    }
  }
}

async function ensureReplicationSlot(
  client: Client,
  args: Args,
  source: CdcSource,
  settings: Map<string, PgSetting>,
) {
  const slot = source.slotName;
  const result = await client.query<{
    slot_name: string;
    active: boolean;
    active_pid: number | null;
  }>(
    `
      SELECT slot_name, active, active_pid
      FROM pg_replication_slots
      WHERE slot_name = $1
    `,
    [slot],
  );
  const existing = result.rows[0];

  if (existing && args.apply && args.devReset) {
    if (existing.active) {
      if (!args.forceActiveSlot) {
        warn(
          `${source.id}: slot ${slot} is active; skip drop. Stop Sequin or pass --force-active-slot`,
        );
      } else if (existing.active_pid) {
        await client.query("SELECT pg_terminate_backend($1)", [
          existing.active_pid,
        ]);
        await client.query("SELECT pg_drop_replication_slot($1)", [slot]);
        warn(
          `${source.id}: terminated active slot backend and dropped ${slot}`,
        );
      }
    } else {
      await client.query("SELECT pg_drop_replication_slot($1)", [slot]);
      warn(`${source.id}: dropped existing slot ${slot}`);
    }
  }

  const current = await client.query<{ slot_name: string; active: boolean }>(
    "SELECT slot_name, active FROM pg_replication_slots WHERE slot_name = $1",
    [slot],
  );
  if ((current.rowCount ?? 0) > 0) {
    ok(`${source.id}: replication slot ${slot} exists`);
    return;
  }

  if (!args.apply) {
    fail(`${source.id}: replication slot ${slot} does not exist`);
    return;
  }

  if (settings.get("wal_level")?.setting !== "logical") {
    warn(
      `${source.id}: cannot create slot ${slot} until Postgres restarts with wal_level=logical`,
    );
    return;
  }

  await client.query(
    "SELECT pg_create_logical_replication_slot($1, 'pgoutput')",
    [slot],
  );
  ok(`${source.id}: created logical replication slot ${slot}`);
}

async function checkSource(args: Args, source: CdcSource) {
  console.log("");
  console.log(`Sequin CDC source: ${source.id} (${source.label})`);
  console.log(`Database: ${connectionLabel(source)}`);
  console.log(`Publication: ${source.publicationName}`);
  console.log(`Replication slot: ${source.slotName}`);

  const client = new Client(connectionConfig(source));
  await client.connect();
  try {
    const settings = await ensureSettings(client, args);
    await assertTrackedTablesExist(client, source);
    await ensurePublication(client, args, source);
    await ensureReplicationSlot(client, args, source, settings);
  } finally {
    await client.end();
  }
}

async function main() {
  const args = parseArgs(Bun.argv.slice(2));
  if (args.help) usage();

  if (args.apply && !args.devReset) {
    throw new Error("--apply requires --dev-reset for this dev-only script");
  }

  console.log(args.apply ? "Mode: apply dev reset" : "Mode: check only");
  if (args.apply) {
    warn(
      "low-level source-object repair only; use `task service -- cdc recover` to stop/restart Sequin and verify the runtime chain",
    );
  }
  for (const source of cdcSources(args)) {
    await checkSource(args, source);
  }
  console.log("");
  console.log("Done.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

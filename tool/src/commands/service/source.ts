import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { Client } from "pg";
import { ROUTED_SEQUIN_TABLES } from "../../../../package/job/src/sequin/manifest";

const TOOL_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const REPO_ROOT = path.resolve(TOOL_DIR, "..");

loadDotenv({ path: path.join(TOOL_DIR, ".env"), override: false, quiet: true });
loadDotenv({
  path: path.join(REPO_ROOT, "package/job-runner/.env"),
  override: false,
  quiet: true,
});

const TRACKED_TABLES = ROUTED_SEQUIN_TABLES;

type Args = {
  apply: boolean;
  devReset: boolean;
  forceActiveSlot: boolean;
  help: boolean;
  url?: string;
};

type PgSetting = {
  name: string;
  setting: string;
  pending_restart: boolean;
};

function parseArgs(argv: string[]): Args {
  const urlArg = argv.find((arg) => arg.startsWith("--url="));
  return {
    apply: argv.includes("--apply"),
    devReset: argv.includes("--dev-reset"),
    forceActiveSlot: argv.includes("--force-active-slot"),
    help: argv.includes("--help") || argv.includes("-h"),
    url: urlArg?.slice("--url=".length),
  };
}

function usage(): never {
  console.log(
    [
      "Usage:",
      "  bun run service source verify [--url=postgresql://...]",
      "  bun run service source repair [--url=postgresql://...] [--force-active-slot]",
      "",
      "Legacy direct usage:",
      "  bun run tool/src/commands/service/source.ts [--url=postgresql://...] [--apply --dev-reset] [--force-active-slot]",
      "",
      "Checks the source Postgres database used by Sequin CDC.",
      "",
      "Verification mode is read-only.",
      "Repair mode is local-development scoped and runs with --apply --dev-reset to:",
      "  - ALTER SYSTEM wal_level=logical",
      "  - ensure max_replication_slots/max_wal_senders",
      "  - recreate rezics_sequin_pub_<ENV>",
      "  - recreate rezics_sequin_slot_<ENV> when wal_level is already logical",
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

function sourceConnectionConfig(args: Args) {
  if (args.url) return { connectionString: args.url };
  if (process.env.SERVER_DATABASE_URL) {
    return { connectionString: process.env.SERVER_DATABASE_URL };
  }
  return {
    host: envValue("SOURCE_DB_HOST", "localhost"),
    port: Number(envValue("SOURCE_DB_PORT", "5432")),
    database: envValue("SOURCE_DB_NAME", "rezics_server"),
    user: envValue("SOURCE_DB_USER", "postgres"),
    password: envValue("SOURCE_DB_PASSWORD"),
  };
}

function redactUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  const auth = url.username ? "<user>:<pass>@" : "";
  return `${url.protocol}//${auth}${url.host}${url.pathname}${url.search}`;
}

function sourceConnectionLabel(args: Args) {
  const config = sourceConnectionConfig(args);
  if (
    "connectionString" in config &&
    typeof config.connectionString === "string"
  ) {
    return redactUrl(config.connectionString);
  }
  return `${config.user}@${config.host}:${config.port}/${config.database}`;
}

function envSuffix() {
  return envValue("ENV", "development");
}

function publicationName() {
  return `rezics_sequin_pub_${envSuffix()}`;
}

function slotName() {
  return `rezics_sequin_slot_${envSuffix()}`;
}

function quoteIdent(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function qualifiedTable(table: string) {
  return `public.${quoteIdent(table)}`;
}

function requiredTableListSql() {
  return TRACKED_TABLES.map(qualifiedTable).join(",\n      ");
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

async function assertTrackedTablesExist(client: Client) {
  const result = await client.query<{ table_name: string }>(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      ORDER BY table_name
    `,
    [TRACKED_TABLES],
  );
  const existing = new Set(result.rows.map((row) => row.table_name));
  const missing = TRACKED_TABLES.filter((table) => !existing.has(table));
  if (missing.length > 0) {
    throw new Error(`Missing tracked table(s): ${missing.join(", ")}`);
  }
  ok(`tracked tables exist (${TRACKED_TABLES.length})`);
}

async function ensurePublication(client: Client, args: Args) {
  const pub = publicationName();
  const existing = await client.query<{ pubname: string }>(
    "SELECT pubname FROM pg_publication WHERE pubname = $1",
    [pub],
  );

  if (args.apply && args.devReset && (existing.rowCount ?? 0) > 0) {
    await client.query(`DROP PUBLICATION ${quoteIdent(pub)}`);
    warn(`dropped existing publication ${pub}`);
  }

  if (args.apply && (args.devReset || (existing.rowCount ?? 0) === 0)) {
    await client.query(
      `
        CREATE PUBLICATION ${quoteIdent(pub)}
        FOR TABLE
          ${requiredTableListSql()}
      `,
    );
    ok(`created publication ${pub}`);
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
  const missing = TRACKED_TABLES.filter((table) => !published.has(table));
  const extra = tables.rows
    .map((row) => row.tablename)
    .filter((table) => !TRACKED_TABLES.includes(table as never));

  if (missing.length === 0 && extra.length === 0) {
    ok(`publication ${pub} tracks exactly ${TRACKED_TABLES.length} table(s)`);
  } else {
    if (missing.length > 0) {
      fail(`publication ${pub} missing: ${missing.join(", ")}`);
    }
    if (extra.length > 0) {
      warn(`publication ${pub} has extra table(s): ${extra.join(", ")}`);
    }
  }
}

async function ensureReplicationSlot(
  client: Client,
  args: Args,
  settings: Map<string, PgSetting>,
) {
  const slot = slotName();
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
          `slot ${slot} is active; skip drop. Stop Sequin or pass --force-active-slot`,
        );
      } else if (existing.active_pid) {
        await client.query("SELECT pg_terminate_backend($1)", [
          existing.active_pid,
        ]);
        await client.query("SELECT pg_drop_replication_slot($1)", [slot]);
        warn(`terminated active slot backend and dropped ${slot}`);
      }
    } else {
      await client.query("SELECT pg_drop_replication_slot($1)", [slot]);
      warn(`dropped existing slot ${slot}`);
    }
  }

  const current = await client.query<{ slot_name: string; active: boolean }>(
    "SELECT slot_name, active FROM pg_replication_slots WHERE slot_name = $1",
    [slot],
  );
  if ((current.rowCount ?? 0) > 0) {
    ok(`replication slot ${slot} exists`);
    return;
  }

  if (!args.apply) {
    fail(`replication slot ${slot} does not exist`);
    return;
  }

  if (settings.get("wal_level")?.setting !== "logical") {
    warn(
      `cannot create slot ${slot} until Postgres restarts with wal_level=logical`,
    );
    return;
  }

  await client.query(
    "SELECT pg_create_logical_replication_slot($1, 'pgoutput')",
    [slot],
  );
  ok(`created logical replication slot ${slot}`);
}

async function main() {
  const args = parseArgs(Bun.argv.slice(2));
  if (args.help) usage();

  if (args.apply && !args.devReset) {
    throw new Error("--apply requires --dev-reset for this dev-only script");
  }

  console.log(`Sequin source DB: ${sourceConnectionLabel(args)}`);
  console.log(`Publication: ${publicationName()}`);
  console.log(`Replication slot: ${slotName()}`);
  console.log(args.apply ? "Mode: apply dev reset" : "Mode: check only");

  const client = new Client(sourceConnectionConfig(args));
  await client.connect();
  try {
    const settings = await ensureSettings(client, args);
    await assertTrackedTablesExist(client);
    await ensurePublication(client, args);
    await ensureReplicationSlot(client, args, settings);
  } finally {
    await client.end();
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

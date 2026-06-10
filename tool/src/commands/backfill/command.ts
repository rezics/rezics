import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { define } from "gunshi";
import pg from "pg";
import { REPO_ROOT } from "../../cli/command-runner";
import { findEnvelopeBackfill, type EnvelopeBackfillSpec } from "./registry";

/**
 * Maintenance backfills own expensive, retryable data movement. Ordinary
 * Drizzle migrations remain the source of truth for schema changes and may
 * contain only small bounded DML. Long-running data backfills and stream tasks
 * run here so they can batch, record progress, throttle, verify, and be safely
 * interrupted.
 */

type BackfillProgress = {
  schemaName: string;
  targetVersion: number;
  cursor: string | null;
  updatedRows: number;
};

type RunOptions = {
  schemaName: string;
  targetVersion: number;
  batchSize: number;
  throttleMs: number;
  dryRun: boolean;
};

const progressDir = join(REPO_ROOT, ".cache/backfill");

function progressPath(schemaName: string, targetVersion: number): string {
  const safeName = schemaName.replace(/[^a-zA-Z0-9_.-]+/g, "_");
  return join(progressDir, `${safeName}-v${targetVersion}.json`);
}

function readProgress(options: RunOptions): BackfillProgress {
  const path = progressPath(options.schemaName, options.targetVersion);
  try {
    return JSON.parse(readFileSync(path, "utf8")) as BackfillProgress;
  } catch {
    return {
      schemaName: options.schemaName,
      targetVersion: options.targetVersion,
      cursor: null,
      updatedRows: 0,
    };
  }
}

function writeProgress(progress: BackfillProgress) {
  mkdirSync(progressDir, { recursive: true });
  writeFileSync(
    progressPath(progress.schemaName, progress.targetVersion),
    `${JSON.stringify(progress, null, 2)}\n`,
  );
}

function quoteIdent(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }
  return `"${value}"`;
}

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for envelope backfills.");
  }
  return url;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connect() {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  return client;
}

async function fetchBatch(
  client: pg.Client,
  spec: EnvelopeBackfillSpec,
  options: RunOptions,
  cursor: string | null,
) {
  const table = quoteIdent(spec.table);
  const cursorColumn = quoteIdent(spec.cursorColumn);
  const jsonColumn = quoteIdent(spec.jsonColumn);
  const query = `
    select ${cursorColumn} as cursor, ${jsonColumn} as payload
    from ${table}
    where ${jsonColumn}->>'schema' = $1
      and (${jsonColumn}->>'version')::int < $2
      and ($3::text is null or ${cursorColumn}::text > $3::text)
    order by ${cursorColumn} asc
    limit $4
  `;
  const result = await client.query(query, [
    spec.schemaName,
    options.targetVersion,
    cursor,
    options.batchSize,
  ]);
  return result.rows as Array<{ cursor: string; payload: unknown }>;
}

async function updateRow(
  client: pg.Client,
  spec: EnvelopeBackfillSpec,
  cursor: string,
  payload: unknown,
) {
  const table = quoteIdent(spec.table);
  const cursorColumn = quoteIdent(spec.cursorColumn);
  const jsonColumn = quoteIdent(spec.jsonColumn);
  await client.query(
    `update ${table} set ${jsonColumn} = $1 where ${cursorColumn}::text = $2`,
    [payload, cursor],
  );
}

async function runEnvelopeBackfill(options: RunOptions) {
  const spec = findEnvelopeBackfill(options.schemaName);
  if (!spec) {
    throw new Error(
      `No envelope backfill registered for ${options.schemaName}.`,
    );
  }
  if (options.targetVersion !== spec.latestVersion) {
    throw new Error(
      `${options.schemaName} can only target latest version ${spec.latestVersion}.`,
    );
  }

  const progress = readProgress(options);
  const client = await connect();
  try {
    while (true) {
      const rows = await fetchBatch(client, spec, options, progress.cursor);
      if (rows.length === 0) break;

      await client.query("begin");
      try {
        for (const row of rows) {
          const upgraded = spec.upgrade(row.payload);
          if (!upgraded) {
            throw new Error(
              `Could not upgrade ${spec.schemaName} row at cursor ${row.cursor}.`,
            );
          }
          if (!options.dryRun) {
            await updateRow(client, spec, row.cursor, upgraded);
          }
          progress.cursor = row.cursor;
          progress.updatedRows += 1;
        }
        if (options.dryRun) {
          await client.query("rollback");
        } else {
          await client.query("commit");
          writeProgress(progress);
        }
      } catch (error) {
        await client.query("rollback");
        throw error;
      }

      console.log(
        `${options.dryRun ? "Would backfill" : "Backfilled"} ${progress.updatedRows} row(s); cursor=${progress.cursor}`,
      );
      if (options.dryRun) break;
      if (options.throttleMs > 0) await sleep(options.throttleMs);
    }
  } finally {
    await client.end();
  }

  console.log(
    `${options.dryRun ? "Dry run complete" : "Backfill complete"} for ${options.schemaName} -> v${options.targetVersion}.`,
  );
}

async function verifyEnvelopeBackfill(schemaName: string) {
  const spec = findEnvelopeBackfill(schemaName);
  if (!spec) {
    throw new Error(`No envelope backfill registered for ${schemaName}.`);
  }
  const client = await connect();
  try {
    const table = quoteIdent(spec.table);
    const jsonColumn = quoteIdent(spec.jsonColumn);
    const result = await client.query(
      `
        select ${jsonColumn}->>'version' as version, count(*)::int as count
        from ${table}
        where ${jsonColumn}->>'schema' = $1
        group by ${jsonColumn}->>'version'
        order by ${jsonColumn}->>'version'
      `,
      [schemaName],
    );
    console.table(result.rows);
  } finally {
    await client.end();
  }
}

function numberValue(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) return Number(value);
  return fallback;
}

export const backfillCommand = define({
  name: "backfill",
  description: "Run resumable persisted JSON envelope backfills.",
  subCommands: {
    run: define({
      name: "run",
      description: "Backfill one envelope schema to its latest version.",
      args: {
        schema: {
          type: "string",
          description: "Envelope schema name, such as rezics/zone-config.",
        },
        targetVersion: {
          type: "string",
          description: "Target latest envelope version.",
        },
        batchSize: {
          type: "number",
          description: "Rows per transaction batch.",
          default: 100,
        },
        throttleMs: {
          type: "number",
          description: "Delay between committed batches.",
          default: 0,
        },
        dryRun: {
          type: "boolean",
          description: "Transform one batch without committing writes.",
        },
      },
      toKebab: true,
      run: async (ctx) => {
        await runEnvelopeBackfill({
          schemaName: String(ctx.values.schema),
          targetVersion: numberValue(ctx.values.targetVersion, 0),
          batchSize: numberValue(ctx.values.batchSize, 100),
          throttleMs: numberValue(ctx.values.throttleMs, 0),
          dryRun: Boolean(ctx.values.dryRun),
        });
      },
    }),
    verify: define({
      name: "verify",
      description: "Report stored row counts by envelope version.",
      args: {
        schema: {
          type: "string",
          description: "Envelope schema name, such as rezics/zone-config.",
        },
      },
      run: async (ctx) => {
        await verifyEnvelopeBackfill(String(ctx.values.schema));
      },
    }),
  },
});

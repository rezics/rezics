import cluster from "node:cluster";
import os from "node:os";
import process from "node:process";

export interface RunClusterOptions {
  /**
   * Number of worker processes. Falls back to the `WORKERS` env var, then to
   * `os.availableParallelism()`. Values < 1 are treated as 1.
   */
  workers?: number;
  /** Service label for primary-process log lines. */
  serviceName?: string;
}

/**
 * Production cluster entrypoint for an Elysia HTTP service.
 *
 * The primary process forks `workers` children (each runs `start`), respawns a
 * worker that exits unexpectedly, and on SIGTERM/SIGINT stops respawning and
 * forwards the signal so each worker drains its own connections before the
 * primary exits. A worker process simply runs `start` (which binds the port).
 *
 * Usage in a service's `cluster.ts`:
 *   runCluster(() => import("./index"), { serviceName: "server" });
 */
export async function runCluster(
  start: () => Promise<unknown>,
  options: RunClusterOptions = {},
): Promise<void> {
  if (!cluster.isPrimary) {
    await start();
    return;
  }

  const count = resolveWorkerCount(options.workers);
  const label = options.serviceName ? `[${options.serviceName}] ` : "";
  console.log(
    `${label}cluster primary ${process.pid} forking ${count} workers`,
  );

  for (let i = 0; i < count; i++) cluster.fork();

  let shuttingDown = false;

  cluster.on("exit", (worker, code, signal) => {
    if (shuttingDown) return;
    console.warn(
      `${label}worker ${worker.process.pid} exited (code=${code} signal=${signal}); respawning`,
    );
    cluster.fork();
  });

  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${label}primary received ${signal}; draining workers`);
    for (const worker of Object.values(cluster.workers ?? {})) {
      worker?.process.kill(signal);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

function resolveWorkerCount(explicit?: number): number {
  if (explicit && explicit > 0) return Math.floor(explicit);
  const fromEnv = process.env.WORKERS
    ? Number(process.env.WORKERS)
    : Number.NaN;
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.floor(fromEnv);
  return Math.max(1, os.availableParallelism());
}

import "dotenv/config";

import { createJobRunnerApp } from "./app";
import { env } from "./env";
import { createJobHandlers } from "./handlers";
import {
  createHistoryRuntime,
  type HistoryRuntime,
} from "./handlers/history/runtime";
import {
  createSearchRuntime,
  type SearchRuntime,
} from "./handlers/search/runtime";
import { createBoss } from "./queue/boss";
import { assertSequinHealthAvailable } from "./sequin/preflight";
import { registerWorkers } from "./worker";

const port = env.PORT ? Number(env.PORT) : 3005;
const role = env.JOB_RUNNER_ROLE;

let boss: Awaited<ReturnType<typeof createBoss>> | undefined;
let app: ReturnType<typeof createJobRunnerApp> | undefined;
let searchRuntime: SearchRuntime | undefined;
let historyRuntime: HistoryRuntime | undefined;

if (role === "all" || role === "worker" || role === "http") {
  boss = await createBoss();
}

await assertSequinHealthAvailable({
  role,
  healthUrl: env.SEQUIN_HEALTH_URL,
});

if ((role === "all" || role === "worker") && boss) {
  searchRuntime = createSearchRuntime({
    serverDatabaseUrl: env.SERVER_DATABASE_URL,
    meiliHost: env.MEILI_HOST,
    meiliMasterKey: env.MEILI_MASTER_KEY,
  });
  historyRuntime = createHistoryRuntime({
    serverDatabaseUrl: env.SERVER_DATABASE_URL,
    historyDatabaseUrl: env.HISTORY_DATABASE_URL,
  });
  await registerWorkers(
    boss as never,
    createJobHandlers({
      searchClient: searchRuntime.client,
      historyConsumer: historyRuntime.consumer,
    }),
  );
}

if ((role === "all" || role === "http") && boss) {
  app = createJobRunnerApp({
    queue: boss as never,
    internalSecret: env.JOB_RUNNER_INTERNAL_SECRET,
    sequinWebhookSecret: env.SEQUIN_WEBHOOK_SECRET,
    readiness: () => Boolean(boss),
  });
  app.listen(port);
  console.log(
    `Job runner service is running at http://${app.server?.hostname}:${app.server?.port}`,
  );
}

async function shutdown() {
  await searchRuntime?.disconnect();
  await historyRuntime?.disconnect();
  await boss?.stop({ graceful: true, timeout: 30_000 });
  app?.server?.stop();
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());

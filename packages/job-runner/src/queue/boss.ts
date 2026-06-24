import PgBoss from "pg-boss";
import { env } from "../env";
import { createQueues } from "./create-queues";

export type JobBoss = PgBoss;

export async function createBoss(connectionString = env.JOB_DATABASE_URL) {
  const boss = new PgBoss({
    connectionString,
  });
  await boss.start();
  await createQueues(boss as never);
  return boss;
}

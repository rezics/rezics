import * as v from "valibot";
import { historyIdempotency } from "../idempotency";
import { JOB_LANES } from "../lanes";
import { jobTags, uniqueTags } from "../tags";
import { commandSchema } from "./common";

export const HISTORY_COMMAND_KINDS = {
  outboxIngest: "history.outbox.ingest",
} as const;

export type HistoryCommandKind =
  (typeof HISTORY_COMMAND_KINDS)[keyof typeof HISTORY_COMMAND_KINDS];

const HistoryOutboxIngestPayloadSchema = v.strictObject({
  outboxId: v.string(),
});

export const HistoryOutboxIngestCommandSchema = commandSchema(
  HISTORY_COMMAND_KINDS.outboxIngest,
  JOB_LANES.historyIngest,
  HistoryOutboxIngestPayloadSchema,
);

export const HistoryCommandSchema = HistoryOutboxIngestCommandSchema;

export type HistoryCommand = v.InferOutput<typeof HistoryCommandSchema>;

export function createHistoryOutboxIngestCommand(
  outboxId: string,
  source: HistoryCommand["source"] = {
    type: "sequin",
    table: "HistoryOutbox",
    action: "insert",
    recordPks: { id: outboxId },
  },
): HistoryCommand {
  return v.parse(HistoryCommandSchema, {
    kind: HISTORY_COMMAND_KINDS.outboxIngest,
    lane: JOB_LANES.historyIngest,
    payload: { outboxId },
    idempotencyKey: historyIdempotency.outboxIngest(outboxId),
    source,
    tags: uniqueTags([
      jobTags.domain("history"),
      jobTags.effect("ingest"),
      jobTags.entity("HistoryOutbox"),
      jobTags.target(outboxId),
      jobTags.source(source.type),
    ]),
  });
}

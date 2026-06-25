import * as v from "valibot";
import { historyIdempotency } from "../idempotency";
import { JOB_LANES } from "../lanes";
import { jobTags, uniqueTags } from "../tags";
import { commandSchema } from "./common";

export const HISTORY_COMMAND_KINDS = {
  outboxIngest: "history.outbox.ingest",
  outboxIngestBatch: "history.outbox.ingestBatch",
} as const;

export type HistoryCommandKind =
  (typeof HISTORY_COMMAND_KINDS)[keyof typeof HISTORY_COMMAND_KINDS];

const HistoryOutboxIngestPayloadSchema = v.strictObject({
  outboxId: v.string(),
});

const HistoryOutboxIngestBatchPayloadSchema = v.strictObject({
  batchSize: v.optional(v.number()),
});

export const HistoryOutboxIngestCommandSchema = commandSchema(
  HISTORY_COMMAND_KINDS.outboxIngest,
  JOB_LANES.historyIngest,
  HistoryOutboxIngestPayloadSchema,
);

export const HistoryOutboxIngestBatchCommandSchema = commandSchema(
  HISTORY_COMMAND_KINDS.outboxIngestBatch,
  JOB_LANES.historyIngest,
  HistoryOutboxIngestBatchPayloadSchema,
);

export const HistoryCommandSchema = v.union([
  HistoryOutboxIngestCommandSchema,
  HistoryOutboxIngestBatchCommandSchema,
]);

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

export function createHistoryOutboxIngestBatchCommand(
  input: { batchSize?: number } = {},
  source: HistoryCommand["source"] = {
    type: "manual",
    reason: "history-outbox-recovery",
  },
): HistoryCommand {
  return v.parse(HistoryCommandSchema, {
    kind: HISTORY_COMMAND_KINDS.outboxIngestBatch,
    lane: JOB_LANES.historyIngest,
    payload: {
      ...(input.batchSize !== undefined ? { batchSize: input.batchSize } : {}),
    },
    idempotencyKey: historyIdempotency.outboxIngestBatch(input.batchSize),
    source,
    tags: uniqueTags([
      jobTags.domain("history"),
      jobTags.effect("ingest"),
      jobTags.effect("batch"),
      jobTags.entity("HistoryOutbox"),
      jobTags.source(source.type),
    ]),
  });
}

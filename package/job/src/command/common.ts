import * as v from "valibot";
import type { JobLane } from "../lanes";
import type { JobTag } from "../tags";

export const CommandSourceSchema = v.union([
  v.strictObject({
    type: v.literal("server"),
    service: v.optional(v.string()),
    requestId: v.optional(v.string()),
  }),
  v.strictObject({
    type: v.literal("sequin"),
    table: v.string(),
    action: v.string(),
    recordPks: v.record(v.string(), v.union([v.string(), v.number()])),
    sequinIdempotencyKey: v.optional(v.string()),
    commitLsn: v.optional(v.string()),
    commitIdx: v.optional(v.number()),
    commitTimestamp: v.optional(v.string()),
  }),
  v.strictObject({
    type: v.literal("maintenance"),
    operatorId: v.optional(v.string()),
    reason: v.optional(v.string()),
  }),
  v.strictObject({
    type: v.literal("manual"),
    reason: v.optional(v.string()),
  }),
]);

export type CommandSource = v.InferOutput<typeof CommandSourceSchema>;

export const ContinuationMetadataSchema = v.strictObject({
  cursor: v.optional(v.string()),
  segment: v.optional(v.number()),
  limit: v.optional(v.number()),
  parentIdempotencyKey: v.optional(v.string()),
});

export type ContinuationMetadata = v.InferOutput<
  typeof ContinuationMetadataSchema
>;

export interface JobCommand<
  Kind extends string = string,
  Lane extends JobLane = JobLane,
  Payload = unknown,
> {
  kind: Kind;
  lane: Lane;
  payload: Payload;
  idempotencyKey: string;
  source: CommandSource;
  tags: JobTag[];
  continuation?: ContinuationMetadata;
}

export const StringRecordSchema = v.record(v.string(), v.unknown());

export function commandSchema<
  const Kind extends string,
  const Lane extends JobLane,
  const Entries extends v.ObjectEntries,
>(kind: Kind, lane: Lane, payload: v.StrictObjectSchema<Entries, undefined>) {
  return v.strictObject({
    kind: v.literal(kind),
    lane: v.literal(lane),
    payload,
    idempotencyKey: v.string(),
    source: CommandSourceSchema,
    tags: v.array(v.string()),
    continuation: v.optional(ContinuationMetadataSchema),
  });
}

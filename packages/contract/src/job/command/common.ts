import type { TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { t, type Static } from "elysia";
import type { JobLane } from "../lanes";
import type { JobTag } from "../tags";

export const CommandSourceSchema = t.Union([
  t.Object(
    {
      type: t.Literal("server"),
      service: t.Optional(t.String()),
      requestId: t.Optional(t.String()),
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      type: t.Literal("sequin"),
      table: t.String(),
      action: t.String(),
      recordPks: t.Record(t.String(), t.Union([t.String(), t.Number()])),
      sequinIdempotencyKey: t.Optional(t.String()),
      commitLsn: t.Optional(t.String()),
      commitIdx: t.Optional(t.Number()),
      commitTimestamp: t.Optional(t.String()),
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      type: t.Literal("maintenance"),
      operatorId: t.Optional(t.String()),
      reason: t.Optional(t.String()),
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      type: t.Literal("manual"),
      reason: t.Optional(t.String()),
    },
    { additionalProperties: false },
  ),
]);

export type CommandSource = Static<typeof CommandSourceSchema>;

export const ContinuationMetadataSchema = t.Object(
  {
    cursor: t.Optional(t.String()),
    segment: t.Optional(t.Number()),
    limit: t.Optional(t.Number()),
    parentIdempotencyKey: t.Optional(t.String()),
  },
  { additionalProperties: false },
);

export type ContinuationMetadata = Static<
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

export const StringRecordSchema = t.Record(t.String(), t.Unknown());

export function commandSchema<
  const Kind extends string,
  const Lane extends JobLane,
  const Payload extends TSchema,
>(kind: Kind, lane: Lane, payload: Payload) {
  return t.Object(
    {
      kind: t.Literal(kind),
      lane: t.Literal(lane),
      payload,
      idempotencyKey: t.String(),
      source: CommandSourceSchema,
      tags: t.Array(t.String()),
      continuation: t.Optional(ContinuationMetadataSchema),
    },
    { additionalProperties: false },
  );
}

export function parseSchema<S extends TSchema>(
  schema: S,
  value: unknown,
): Static<S> {
  if (!Value.Check(schema, value))
    throw new TypeError("Invalid contract payload");
  return Value.Decode(schema, value) as Static<S>;
}

export function safeParseSchema<S extends TSchema>(schema: S, value: unknown) {
  return Value.Check(schema, value)
    ? {
        success: true as const,
        output: Value.Decode(schema, value) as Static<S>,
      }
    : { success: false as const };
}

import * as v from "valibot";
import { rankingIdempotency } from "../idempotency";
import { JOB_LANES } from "../lanes";
import { jobTags, uniqueTags } from "../tags";
import { commandSchema } from "./common";

export const RANKING_COMMAND_KINDS = {
  invalidate: "ranking.invalidate",
  recompute: "ranking.recompute",
  patchServing: "ranking.patchServing",
  fullSync: "ranking.fullSync",
  viewBucketFlush: "ranking.viewBucketFlush",
  reactionBucket: "ranking.reactionBucket",
} as const;

export type RankingCommandKind =
  (typeof RANKING_COMMAND_KINDS)[keyof typeof RANKING_COMMAND_KINDS];

export const RankingScopeSchema = v.strictObject({
  kind: v.union([
    v.literal("global"),
    v.literal("realm"),
    v.literal("work"),
    v.literal("tag"),
    v.literal("parent"),
  ]),
  id: v.optional(v.string()),
});

export const RankingRankKindSchema = v.union([
  v.literal("content"),
  v.literal("post"),
  v.literal("comment"),
]);

const RankingTargetPayloadSchema = v.strictObject({
  unitId: v.string(),
  scope: v.optional(RankingScopeSchema),
  rankKind: v.optional(RankingRankKindSchema),
  reason: v.optional(v.string()),
});

const RankingPatchPayloadSchema = v.strictObject({
  unitId: v.optional(v.string()),
  projectionId: v.optional(v.string()),
  rankKind: v.optional(RankingRankKindSchema),
  limit: v.optional(v.number()),
});

const RankingFullSyncPayloadSchema = v.strictObject({
  cursor: v.optional(v.string()),
  limit: v.optional(v.number()),
  rankKind: v.optional(RankingRankKindSchema),
});

const RankingViewBucketFlushPayloadSchema = v.strictObject({
  cursor: v.optional(v.string()),
  limit: v.optional(v.number()),
  bucketBefore: v.optional(v.string()),
});

const RankingReactionBucketPayloadSchema = v.strictObject({
  targetId: v.string(),
  scopeKey: v.string(),
  reaction: v.union([v.literal("upvote"), v.literal("downvote")]),
  count: v.number(),
  at: v.optional(v.string()),
});

export const RankingInvalidateCommandSchema = commandSchema(
  RANKING_COMMAND_KINDS.invalidate,
  JOB_LANES.ranking,
  RankingTargetPayloadSchema,
);
export const RankingRecomputeCommandSchema = commandSchema(
  RANKING_COMMAND_KINDS.recompute,
  JOB_LANES.ranking,
  RankingTargetPayloadSchema,
);
export const RankingPatchServingCommandSchema = commandSchema(
  RANKING_COMMAND_KINDS.patchServing,
  JOB_LANES.ranking,
  RankingPatchPayloadSchema,
);
export const RankingFullSyncCommandSchema = commandSchema(
  RANKING_COMMAND_KINDS.fullSync,
  JOB_LANES.ranking,
  RankingFullSyncPayloadSchema,
);
export const RankingViewBucketFlushCommandSchema = commandSchema(
  RANKING_COMMAND_KINDS.viewBucketFlush,
  JOB_LANES.ranking,
  RankingViewBucketFlushPayloadSchema,
);
export const RankingReactionBucketCommandSchema = commandSchema(
  RANKING_COMMAND_KINDS.reactionBucket,
  JOB_LANES.ranking,
  RankingReactionBucketPayloadSchema,
);

export const RankingCommandSchema = v.union([
  RankingInvalidateCommandSchema,
  RankingRecomputeCommandSchema,
  RankingPatchServingCommandSchema,
  RankingFullSyncCommandSchema,
  RankingViewBucketFlushCommandSchema,
  RankingReactionBucketCommandSchema,
]);

export type RankingCommand = v.InferOutput<typeof RankingCommandSchema>;
export type RankingScope = v.InferOutput<typeof RankingScopeSchema>;
export type RankingRankKind = v.InferOutput<typeof RankingRankKindSchema>;

function sourceTag(source: RankingCommand["source"]) {
  return jobTags.source(source.type);
}

function operationFor(kind: RankingCommandKind) {
  return kind.split(".")[1] ?? "ranking";
}

export function createRankingCommand(
  kind: RankingCommandKind,
  payload: RankingCommand["payload"],
  source: RankingCommand["source"] = { type: "server" },
): RankingCommand {
  const payloadRecord = payload as Record<string, any>;
  const idempotencyKey =
    kind === RANKING_COMMAND_KINDS.invalidate ||
    kind === RANKING_COMMAND_KINDS.recompute
      ? rankingIdempotency.target(
          kind,
          typeof payloadRecord.unitId === "string"
            ? payloadRecord.unitId
            : "all",
          payloadRecord.scope,
          payloadRecord.rankKind,
        )
      : kind === RANKING_COMMAND_KINDS.patchServing
        ? rankingIdempotency.patchServing(
            payloadRecord.projectionId ?? payloadRecord.unitId ?? "pending",
            payloadRecord.rankKind,
          )
        : kind === RANKING_COMMAND_KINDS.reactionBucket
          ? rankingIdempotency.reactionBucket(
              payloadRecord.targetId,
              payloadRecord.scopeKey,
              payloadRecord.reaction,
              payloadRecord.at,
            )
          : kind === RANKING_COMMAND_KINDS.viewBucketFlush
            ? rankingIdempotency.viewBucketFlush(payloadRecord.cursor)
            : rankingIdempotency.fullSync(
                payloadRecord.cursor,
                payloadRecord.rankKind,
              );

  return v.parse(RankingCommandSchema, {
    kind,
    lane: JOB_LANES.ranking,
    payload,
    idempotencyKey,
    source,
    tags: uniqueTags([
      jobTags.domain("ranking"),
      jobTags.effect(operationFor(kind)),
      sourceTag(source),
    ]),
  });
}

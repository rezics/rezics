import { t, type Static } from "elysia";
import { rankingIdempotency } from "../idempotency";
import { JOB_LANES } from "../lanes";
import { jobTags, uniqueTags } from "../tags";
import { commandSchema, parseSchema } from "./common";

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

export const RankingScopeSchema = t.Object(
  {
    kind: t.Union([
      t.Literal("global"),
      t.Literal("realm"),
      t.Literal("work"),
      t.Literal("tag"),
      t.Literal("parent"),
    ]),
    id: t.Optional(t.String()),
  },
  { additionalProperties: false },
);

export const RankingRankKindSchema = t.Union([
  t.Literal("content"),
  t.Literal("post"),
  t.Literal("comment"),
]);

const RankingTargetPayloadSchema = t.Object(
  {
    unitId: t.String(),
    scope: t.Optional(RankingScopeSchema),
    rankKind: t.Optional(RankingRankKindSchema),
    reason: t.Optional(t.String()),
  },
  { additionalProperties: false },
);

const RankingPatchPayloadSchema = t.Object(
  {
    unitId: t.Optional(t.String()),
    projectionId: t.Optional(t.String()),
    rankKind: t.Optional(RankingRankKindSchema),
    limit: t.Optional(t.Number()),
  },
  { additionalProperties: false },
);

const RankingFullSyncPayloadSchema = t.Object(
  {
    cursor: t.Optional(t.String()),
    limit: t.Optional(t.Number()),
    rankKind: t.Optional(RankingRankKindSchema),
  },
  { additionalProperties: false },
);

const RankingViewBucketFlushPayloadSchema = t.Object(
  {
    cursor: t.Optional(t.String()),
    limit: t.Optional(t.Number()),
    bucketBefore: t.Optional(t.String()),
  },
  { additionalProperties: false },
);

const RankingReactionBucketPayloadSchema = t.Object(
  {
    targetId: t.String(),
    contextUnitId: t.Optional(t.String()),
    reaction: t.Union([t.Literal("upvote"), t.Literal("downvote")]),
    count: t.Number(),
    at: t.Optional(t.String()),
  },
  { additionalProperties: false },
);

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

export const RankingCommandSchema = t.Union([
  RankingInvalidateCommandSchema,
  RankingRecomputeCommandSchema,
  RankingPatchServingCommandSchema,
  RankingFullSyncCommandSchema,
  RankingViewBucketFlushCommandSchema,
  RankingReactionBucketCommandSchema,
]);

export type RankingCommand = Static<typeof RankingCommandSchema>;
export type RankingScope = Static<typeof RankingScopeSchema>;
export type RankingRankKind = Static<typeof RankingRankKindSchema>;

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
              payloadRecord.contextUnitId,
              payloadRecord.reaction,
              payloadRecord.at,
            )
          : kind === RANKING_COMMAND_KINDS.viewBucketFlush
            ? rankingIdempotency.viewBucketFlush(payloadRecord.cursor)
            : rankingIdempotency.fullSync(
                payloadRecord.cursor,
                payloadRecord.rankKind,
              );

  return parseSchema(RankingCommandSchema, {
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

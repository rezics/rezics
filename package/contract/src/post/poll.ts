import { t } from "elysia";

// ============================================================
// POLL LITERALS
// ============================================================

/** How many options a voter may hold at once. */
export const pollVoteModeSchema = t.Union([
  t.Literal("SINGLE"),
  t.Literal("MULTI"),
]);

export type PollVoteMode = (typeof pollVoteModeSchema)["static"];

/** When tallies become readable to non-privileged callers. */
export const pollResultVisibilitySchema = t.Union([
  t.Literal("LIVE"),
  t.Literal("AFTER_CLOSE"),
]);

export type PollResultVisibility =
  (typeof pollResultVisibilitySchema)["static"];

// ============================================================
// POLL OPTION DTO (dual-form: label xor unitId)
// ============================================================

/**
 * A poll option. Exactly one of `label` (ad-hoc text) or `unitId` (reference to
 * an existing Unit) is set; the client renders whichever is present. A
 * tombstoned option (referenced unit deleted) has both null but retains its
 * `voteCount`. `voteCount` is omitted when results are withheld (AFTER_CLOSE
 * before close).
 */
export const pollOptionDTOSchema = t.Object({
  pollUnitId: t.String(),
  optionId: t.String(),
  position: t.String(),
  label: t.Optional(t.Nullable(t.String())),
  unitId: t.Optional(t.Nullable(t.String())),
  voteCount: t.Optional(t.Number()),
});

export type PollOptionDTO = (typeof pollOptionDTOSchema)["static"];

// ============================================================
// POLL DTO
// ============================================================

export const pollDTOSchema = t.Object({
  unitId: t.String(),
  title: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.Nullable(t.String())),
  voteMode: pollVoteModeSchema,
  resultVisibility: pollResultVisibilitySchema,
  anonymous: t.Boolean(),
  closesAt: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
  /** Derived: the poll is past `closesAt`. */
  closed: t.Boolean(),
  usageCount: t.Number(),
  /** Derived from `usageCount > 0`. */
  used: t.Boolean(),
  options: t.Array(pollOptionDTOSchema),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type PollDTO = (typeof pollDTOSchema)["static"];

// ============================================================
// CREATE POLL (with options)
// ============================================================

/**
 * One option in a create-poll request. Exactly one of `label` / `unitId` must
 * be provided; the xor is enforced server-side (TypeBox cannot express it).
 * `position` is optional — the server assigns fractional positions in order
 * when omitted.
 */
export const createPollOptionSchema = t.Object({
  label: t.Optional(t.String()),
  unitId: t.Optional(t.String()),
  position: t.Optional(t.String()),
});

export type CreatePollOptionInput = (typeof createPollOptionSchema)["static"];

export const createPollSchema = t.Object({
  title: t.String({ minLength: 1, maxLength: 200 }),
  description: t.Optional(t.String({ maxLength: 5000 })),
  language: t.Optional(t.String()),
  voteMode: t.Optional(pollVoteModeSchema),
  resultVisibility: t.Optional(pollResultVisibilitySchema),
  anonymous: t.Optional(t.Boolean()),
  closesAt: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
  options: t.Array(createPollOptionSchema, { minItems: 2 }),
});

export type CreatePollInput = (typeof createPollSchema)["static"];

// ============================================================
// VOTE (cast / change / withdraw)
// ============================================================

/**
 * Cast or change a vote. For SINGLE polls a repeat call moves the user's single
 * vote to `optionId`; for MULTI polls it adds `optionId` to the user's set.
 */
export const castPollVoteSchema = t.Object({
  optionId: t.String(),
  realmUnitId: t.Optional(t.String()),
});

export type CastPollVoteInput = (typeof castPollVoteSchema)["static"];

/**
 * Withdraw a vote. For MULTI polls `optionId` selects which option to drop; for
 * SINGLE polls it is optional (the user holds at most one vote).
 */
export const withdrawPollVoteSchema = t.Object({
  optionId: t.Optional(t.String()),
  realmUnitId: t.Optional(t.String()),
});

export type WithdrawPollVoteInput = (typeof withdrawPollVoteSchema)["static"];

export const pollPathParamsSchema = t.Object({
  pollUnitId: t.String(),
});

export type PollPathParams = (typeof pollPathParamsSchema)["static"];

export const pollCallerVoteContextDTOSchema = t.Object({
  optionId: t.String(),
  realmUnitId: t.Optional(t.Nullable(t.String())),
});

export type PollCallerVoteContextDTO =
  (typeof pollCallerVoteContextDTOSchema)["static"];

// ============================================================
// POLL RESULTS (tallies — conditional on resultVisibility + anonymity)
// ============================================================

/**
 * Poll results. `resultsVisible` is false when tallies are withheld
 * (AFTER_CLOSE before close); in that case option `voteCount` and `totalVotes`
 * are omitted. The voter↔option mapping is NEVER serialized for anonymous
 * polls — only aggregate tallies plus the caller's own `myVote` are returned.
 */
export const pollResultsDTOSchema = t.Object({
  pollUnitId: t.String(),
  voteMode: pollVoteModeSchema,
  resultVisibility: pollResultVisibilitySchema,
  anonymous: t.Boolean(),
  closed: t.Boolean(),
  closesAt: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
  /** Whether tallies are exposed to this caller. */
  resultsVisible: t.Boolean(),
  options: t.Array(pollOptionDTOSchema),
  /** Sum of votes across options; omitted when results are withheld. */
  totalVotes: t.Optional(t.Number()),
  /** The option ids the calling user has voted for — always included. */
  myVote: t.Array(t.String()),
  /** Caller vote rows with optional realm context metadata, always included. */
  myVoteContexts: t.Array(pollCallerVoteContextDTOSchema),
});

export type PollResultsDTO = (typeof pollResultsDTOSchema)["static"];

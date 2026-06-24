import { t } from "elysia";

// ============================================================
// POLL LITERALS
// 投票字面量
// ============================================================

/**
 * How many options a voter may hold at once.
 * 投票者可同时持有的选项数量。
 */
export const pollVoteModeValues = ["SINGLE", "MULTI"] as const;

export const pollVoteModeSchema = t.Union([
  t.Literal("SINGLE"),
  t.Literal("MULTI"),
]);

export type PollVoteMode = (typeof pollVoteModeSchema)["static"];

/**
 * When tallies become readable to non-privileged callers.
 * 计票结果何时对无特权调用者可见。
 */
export const pollResultVisibilityValues = ["LIVE", "AFTER_CLOSE"] as const;

export const pollResultVisibilitySchema = t.Union([
  t.Literal("LIVE"),
  t.Literal("AFTER_CLOSE"),
]);

export type PollResultVisibility =
  (typeof pollResultVisibilitySchema)["static"];

// ============================================================
// POLL OPTION DTO (dual-form: label xor unitId)
// 投票选项 DTO（双形态：label 与 unitId 异或）
// ============================================================

/**
 * A poll option. Exactly one of `label` (ad-hoc text) or `unitId` (reference to
 * an existing Unit) is set; the client renders whichever is present. A
 * tombstoned option (referenced unit deleted) has both null but retains its
 * `voteCount`. `voteCount` is omitted when results are withheld (AFTER_CLOSE
 * before close).
 * 一个投票选项。`label`（临时文本）与 `unitId`（引用已存在的 Unit）中恰好设置一个；
 * 客户端渲染其中存在的那一个。被墓碑化的选项（被引用的 unit 已删除）两者皆为 null，
 * 但仍保留其 `voteCount`。当结果被隐藏时（AFTER_CLOSE 且尚未关闭）省略 `voteCount`。
 */
export const pollOptionDTOSchema = t.Object({
  pollUnitId: t.String(),
  optionId: t.String(),
  position: t.String(), // Fractional Indexing
  label: t.Optional(t.Nullable(t.String())),
  unitId: t.Optional(t.Nullable(t.String())),
  voteCount: t.Optional(t.Number()),
});

export type PollOptionDTO = (typeof pollOptionDTOSchema)["static"];

// ============================================================
// POLL DTO
// 投票 DTO
// ============================================================

export const pollDTOSchema = t.Object({
  unitId: t.String(),
  title: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.Nullable(t.String())),
  voteMode: pollVoteModeSchema,
  resultVisibility: pollResultVisibilitySchema,
  anonymous: t.Boolean(),
  closesAt: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
  /**
   * Derived: the poll is past `closesAt`.
   * 派生值：投票已超过 `closesAt`。
   */
  closed: t.Boolean(),
  usageCount: t.Number(),
  /**
   * Derived from `usageCount > 0`.
   * 由 `usageCount > 0` 派生而来。
   */
  used: t.Boolean(),
  options: t.Array(pollOptionDTOSchema),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type PollDTO = (typeof pollDTOSchema)["static"];

// ============================================================
// CREATE POLL (with options)
// 创建投票（含选项）
// ============================================================

/**
 * One option in a create-poll request. Exactly one of `label` / `unitId` must
 * be provided; the xor is enforced server-side (TypeBox cannot express it).
 * `position` is optional — the server assigns fractional positions in order
 * when omitted.
 * 创建投票请求中的一个选项。`label` / `unitId` 中必须恰好提供一个；该异或约束在服务端强制
 * （TypeBox 无法表达）。`position` 可选——省略时服务端按顺序分配小数位置。
 */
export const createPollOptionSchema = t.Object({
  label: t.Optional(t.String()),
  unitId: t.Optional(t.String()),
  position: t.Optional(t.String()), // Fractional Indexing
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
// 投票（投出 / 更改 / 撤回）
// ============================================================

/**
 * Cast or change a vote. For SINGLE polls a repeat call moves the user's single
 * vote to `optionId`; for MULTI polls it adds `optionId` to the user's set.
 * 投票或更改投票。对于 SINGLE 投票，重复调用会把用户的单票移动到 `optionId`；
 * 对于 MULTI 投票，则把 `optionId` 加入用户的选项集合。
 */
export const castPollVoteSchema = t.Object({
  optionId: t.String(),
  realmUnitId: t.Optional(t.String()),
});

export type CastPollVoteInput = (typeof castPollVoteSchema)["static"];

/**
 * Withdraw a vote. For MULTI polls `optionId` selects which option to drop; for
 * SINGLE polls it is optional (the user holds at most one vote).
 * 撤回投票。对于 MULTI 投票，`optionId` 指定要撤销的选项；
 * 对于 SINGLE 投票则可选（用户至多持有一票）。
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
// 投票结果（计票——取决于 resultVisibility 与匿名性）
// ============================================================

/**
 * Poll results. `resultsVisible` is false when tallies are withheld
 * (AFTER_CLOSE before close); in that case option `voteCount` and `totalVotes`
 * are omitted. The voter↔option mapping is NEVER serialized for anonymous
 * polls — only aggregate tallies plus the caller's own `myVote` are returned.
 * 投票结果。当计票被隐藏时（AFTER_CLOSE 且尚未关闭）`resultsVisible` 为 false；
 * 此时省略选项的 `voteCount` 与 `totalVotes`。匿名投票中投票者↔选项的映射永不序列化——
 * 仅返回聚合计票以及调用者自身的 `myVote`。
 */
export const pollResultsDTOSchema = t.Object({
  pollUnitId: t.String(),
  voteMode: pollVoteModeSchema,
  resultVisibility: pollResultVisibilitySchema,
  anonymous: t.Boolean(),
  closed: t.Boolean(),
  closesAt: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
  /**
   * Whether tallies are exposed to this caller.
   * 计票是否对此调用者公开。
   */
  resultsVisible: t.Boolean(),
  options: t.Array(pollOptionDTOSchema),
  /**
   * Sum of votes across options; omitted when results are withheld.
   * 各选项票数之和；当结果被隐藏时省略。
   */
  totalVotes: t.Optional(t.Number()),
  /**
   * The option ids the calling user has voted for — always included.
   * 调用用户已投票的选项 id——始终包含。
   */
  myVote: t.Array(t.String()),
  /**
   * Caller vote rows with optional realm context metadata, always included.
   * 调用者的投票记录，附带可选的 realm 上下文元数据，始终包含。
   */
  myVoteContexts: t.Array(pollCallerVoteContextDTOSchema),
});

export type PollResultsDTO = (typeof pollResultsDTOSchema)["static"];

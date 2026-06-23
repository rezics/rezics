import { Effect, Option } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { and, asc, eq, sql } from "drizzle-orm";

import { Database } from "../../database/index.ts";
import {
  Poll,
  PollOption,
  PollVote,
  Unit,
  UnitTranslation,
} from "../../database/schema/all.ts";
import { Api } from "../interfaces/index.ts";
import { CurrentUser } from "../interfaces/middlewares/auth.ts";
import { CurrentUserOption } from "../interfaces/middlewares/auth.ts";
import {
  Poll as PollDTO,
  PollForbidden,
  PollNotFound,
  PollOptionDTO,
  PollVoteContext,
} from "../interfaces/polls.ts";

// ---------------------------------------------------------------------------
// Helpers / 辅助函数
// ---------------------------------------------------------------------------

/** Whether a poll is past its close time. 投票是否已过关闭时间。 */
function isPollClosed(poll: { closesAt: Date | null }): boolean {
  return poll.closesAt !== null && poll.closesAt.getTime() <= Date.now();
}

/** Generate sequential fractional-index positions for options. 为选项生成顺序分数索引 position。 */
function generatePositions(count: number): string[] {
  // Simple ascending lowercase alpha keys: "a", "b", "c", ...
  // 简单的升序小写字母键："a"、"b"、"c"……
  return Array.from({ length: count }, (_, i) => String.fromCharCode(97 + i));
}

// ---------------------------------------------------------------------------
// Mappers / 映射函数
// ---------------------------------------------------------------------------

function optionToDTO(
  option: typeof PollOption.$inferSelect,
  isResultsVisible: boolean,
): PollOptionDTO {
  return new PollOptionDTO({
    pollUnitId: option.pollUnitId,
    optionId: option.optionId,
    position: option.position,
    label: option.label ?? null,
    unitId: option.unitId ?? null,
    voteCount: isResultsVisible ? option.voteCount : null,
  });
}

function buildPollDTO(
  poll: typeof Poll.$inferSelect,
  options: (typeof PollOption.$inferSelect)[],
  opts: {
    isResultsVisible: boolean;
    myVote: string[];
    myVoteContexts: PollVoteContext[];
  },
): PollDTO {
  const closed = isPollClosed(poll);
  return new PollDTO({
    pollUnitId: poll.unitId,
    voteMode: poll.voteMode,
    resultVisibility: poll.resultVisibility,
    isAnonymous: poll.anonymous,
    isClosed: closed,
    closesAt: poll.closesAt?.toISOString() ?? null,
    isResultsVisible: opts.isResultsVisible,
    usageCount: poll.usageCount,
    options: options.map((o) => optionToDTO(o, opts.isResultsVisible)),
    totalVotes: opts.isResultsVisible
      ? options.reduce((sum, o) => sum + o.voteCount, 0)
      : null,
    myVote: opts.myVote,
    myVoteContexts: opts.myVoteContexts,
    createdAt: poll.createdAt.toISOString(),
    updatedAt: poll.updatedAt.toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Handlers / 处理器
// ---------------------------------------------------------------------------

export const PollsHandlers = HttpApiBuilder.group(
  Api,
  "polls",
  Effect.fn(function* (handlers) {
    const database = yield* Database;

    // Shared core: fetch poll row, options, user votes, and build DTO.
    // Returns `undefined` when the poll does not exist.
    // 共享核心：获取投票行、选项、用户投票并构建 DTO。当投票不存在时返回 undefined。
    const fetchPollCore = (pollUnitId: string, userId: string | undefined) =>
      Effect.gen(function* () {
        const polls = yield* Effect.orDie(
          database.select().from(Poll).where(eq(Poll.unitId, pollUnitId)),
        );
        if (!polls[0]) return undefined;
        const poll = polls[0];

        const options = yield* Effect.orDie(
          database
            .select()
            .from(PollOption)
            .where(eq(PollOption.pollUnitId, pollUnitId))
            .orderBy(asc(PollOption.position), asc(PollOption.optionId)),
        );

        // Result-visibility gating: LIVE always visible, AFTER_CLOSE only when closed or privileged
        // 结果可见性门控：LIVE 始终可见，AFTER_CLOSE 仅在关闭后或有特权时可见
        const closed = isPollClosed(poll);
        const ownerRows = userId
          ? yield* Effect.orDie(
              database
                .select({ userId: Unit.userId })
                .from(Unit)
                .where(eq(Unit.id, pollUnitId)),
            )
          : [];
        const isOwner = ownerRows[0]?.userId === userId;
        const isResultsVisible =
          poll.resultVisibility === "LIVE" || closed || isOwner;

        // Fetch the caller's own votes / 获取调用者自身的投票
        const myVote: string[] = [];
        const myVoteContexts: PollVoteContext[] = [];
        if (userId) {
          const votes = yield* Effect.orDie(
            database
              .select({
                optionId: PollVote.optionId,
                realmUnitId: PollVote.realmUnitId,
              })
              .from(PollVote)
              .where(
                and(
                  eq(PollVote.pollUnitId, pollUnitId),
                  eq(PollVote.userId, userId),
                ),
              ),
          );
          for (const v of votes) {
            myVote.push(v.optionId);
            myVoteContexts.push(
              new PollVoteContext({
                optionId: v.optionId,
                realmUnitId: v.realmUnitId ?? null,
              }),
            );
          }
        }

        return buildPollDTO(poll, options, {
          isResultsVisible,
          myVote,
          myVoteContexts,
        });
      });

    // Wrapper that yields PollNotFound when the poll does not exist
    // 当投票不存在时产出 PollNotFound 的包装函数
    const fetchPollOrNotFound = (
      pollUnitId: string,
      userId: string | undefined,
    ) =>
      Effect.gen(function* () {
        const result = yield* fetchPollCore(pollUnitId, userId);
        if (!result) return yield* new PollNotFound();
        return result;
      });

    // Wrapper that treats missing poll as a defect (for post-creation reads)
    // 将缺失投票视为缺陷的包装函数（用于创建后读取）
    const fetchPollOrDie = (pollUnitId: string, userId: string) =>
      Effect.gen(function* () {
        const result = yield* fetchPollCore(pollUnitId, userId);
        if (!result) return yield* Effect.die(new Error("Poll not found after creation"));
        return result;
      });

    return handlers
      // ── Create poll / 创建投票 ─────────────────────────────────
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const now = new Date();
          const voteMode = payload.allowMultiple ? "MULTI" : "SINGLE";
          const closesAt = payload.closesAt ? new Date(payload.closesAt) : null;

          // Create the Unit row / 创建 Unit 行
          const unitRows = yield* Effect.orDie(
            database
              .insert(Unit)
              .values({
                type: "POLL",
                userId: user.id,
                slugScope: user.id,
                status: "PUBLISHED",
                publishedAt: now,
                defaultLanguage: "en",
              })
              .returning(),
          );
          const unit = unitRows[0]!;

          // Store the question as UnitTranslation title / 将问题存为 UnitTranslation 标题
          yield* Effect.orDie(
            database.insert(UnitTranslation).values({
              unitId: unit.id,
              language: "en",
              title: payload.question,
            }),
          );

          // Create the Poll extension row / 创建 Poll 扩展行
          yield* Effect.orDie(
            database.insert(Poll).values({
              unitId: unit.id,
              voteMode,
              resultVisibility: "LIVE",
              anonymous: false,
              closesAt,
            }),
          );

          // Create PollOption rows / 创建 PollOption 行
          const positions = generatePositions(payload.options.length);
          yield* Effect.orDie(
            database.insert(PollOption).values(
              payload.options.map((label, i) => ({
                pollUnitId: unit.id,
                position: positions[i]!,
                label,
              })),
            ),
          );

          return yield* fetchPollOrDie(unit.id, user.id);
        }),
      )

      // ── Get poll / 获取投票 ────────────────────────────────────
      .handle("get", ({ params }) =>
        Effect.gen(function* () {
          const userOption = yield* CurrentUserOption;
          const userId = Option.isSome(userOption)
            ? userOption.value.id
            : undefined;
          return yield* fetchPollOrNotFound(params.pollUnitId, userId);
        }),
      )

      // ── Cast vote / 投票 ───────────────────────────────────────
      .handle("vote", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const pollUnitId = params.pollUnitId;

          // Validate poll exists and is open / 校验投票存在且未关闭
          const polls = yield* Effect.orDie(
            database.select().from(Poll).where(eq(Poll.unitId, pollUnitId)),
          );
          if (!polls[0]) return yield* new PollNotFound();
          const poll = polls[0];

          if (isPollClosed(poll)) {
            return yield* new PollForbidden();
          }

          for (const optionId of payload.optionIds) {
            // Validate option belongs to this poll / 校验选项属于此投票
            const optionRows = yield* Effect.orDie(
              database
                .select()
                .from(PollOption)
                .where(
                  and(
                    eq(PollOption.pollUnitId, pollUnitId),
                    eq(PollOption.optionId, optionId),
                  ),
                ),
            );
            if (!optionRows[0]) return yield* new PollNotFound();

            if (poll.voteMode === "SINGLE") {
              // SINGLE mode: remove existing vote first, then insert new one
              // SINGLE 模式：先移除现有投票，再插入新投票
              const existingVotes = yield* Effect.orDie(
                database
                  .select()
                  .from(PollVote)
                  .where(
                    and(
                      eq(PollVote.pollUnitId, pollUnitId),
                      eq(PollVote.userId, user.id),
                    ),
                  ),
              );
              if (existingVotes[0]) {
                if (existingVotes[0].optionId === optionId) continue;
                // Decrement old option's vote count / 递减旧选项的投票计数
                yield* Effect.orDie(
                  database
                    .update(PollOption)
                    .set({
                      voteCount: sql`${PollOption.voteCount} - 1`,
                      updatedAt: new Date(),
                    })
                    .where(
                      and(
                        eq(PollOption.pollUnitId, pollUnitId),
                        eq(PollOption.optionId, existingVotes[0].optionId),
                      ),
                    ),
                );
                // Remove the old vote row / 移除旧投票行
                yield* Effect.orDie(
                  database
                    .delete(PollVote)
                    .where(
                      and(
                        eq(PollVote.pollUnitId, pollUnitId),
                        eq(PollVote.userId, user.id),
                        eq(PollVote.optionId, existingVotes[0].optionId),
                      ),
                    ),
                );
              }
            } else {
              // MULTI mode: skip if already voted for this option
              // MULTI 模式：若已对该选项投过票则跳过
              const existingVote = yield* Effect.orDie(
                database
                  .select()
                  .from(PollVote)
                  .where(
                    and(
                      eq(PollVote.pollUnitId, pollUnitId),
                      eq(PollVote.userId, user.id),
                      eq(PollVote.optionId, optionId),
                    ),
                  ),
              );
              if (existingVote[0]) continue;
            }

            // Insert new vote / 插入新投票
            yield* Effect.orDie(
              database.insert(PollVote).values({
                pollUnitId,
                userId: user.id,
                optionId,
                voteMode: poll.voteMode,
              }),
            );

            // Increment option's vote count / 递增选项的投票计数
            yield* Effect.orDie(
              database
                .update(PollOption)
                .set({
                  voteCount: sql`${PollOption.voteCount} + 1`,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(PollOption.pollUnitId, pollUnitId),
                    eq(PollOption.optionId, optionId),
                  ),
                ),
            );
          }

          return yield* fetchPollOrNotFound(pollUnitId, user.id);
        }),
      )

      // ── Retract vote / 撤回投票 ───────────────────────────────
      .handle("unvote", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const pollUnitId = params.pollUnitId;

          // Validate poll exists / 校验投票存在
          const polls = yield* Effect.orDie(
            database.select().from(Poll).where(eq(Poll.unitId, pollUnitId)),
          );
          if (!polls[0]) return yield* new PollNotFound();

          // Find all votes by this user on this poll / 查找此用户在此投票上的所有投票
          const votes = yield* Effect.orDie(
            database
              .select()
              .from(PollVote)
              .where(
                and(
                  eq(PollVote.pollUnitId, pollUnitId),
                  eq(PollVote.userId, user.id),
                ),
              ),
          );

          // Remove each vote and decrement the corresponding option count
          // 移除每条投票并递减对应选项的计数
          for (const vote of votes) {
            yield* Effect.orDie(
              database
                .delete(PollVote)
                .where(eq(PollVote.id, vote.id)),
            );
            yield* Effect.orDie(
              database
                .update(PollOption)
                .set({
                  voteCount: sql`${PollOption.voteCount} - 1`,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(PollOption.pollUnitId, pollUnitId),
                    eq(PollOption.optionId, vote.optionId),
                  ),
                ),
            );
          }
        }),
      );
  }),
);

import type { CreatePollInput } from "@rezics/contract";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import { and, asc, eq, sql } from "drizzle-orm";
import { keyAfter } from "@/book/position-index";
import {
  Poll,
  PollOption,
  PollVote,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
} from "../db/schema";
import { isPollClosed } from "./poll.mapper";
import type { PollWithOptions } from "./poll.types";

export class PollError extends Error {
  constructor(
    public code:
      | "POLL_NOT_FOUND"
      | "OPTION_NOT_FOUND"
      | "INVALID_OPTION"
      | "TOO_FEW_OPTIONS"
      | "POLL_CLOSED"
      | "VOTE_MODE_LOCKED"
      | "WITHDRAW_OPTION_REQUIRED",
    message: string,
    public httpStatus: 400 | 403 | 404 | 409,
  ) {
    super(message);
    this.name = "PollError";
  }
}

/**
 * Reject an option whose `label`/`unitId` are not in exactly-one (xor) form.
 * 拒绝 `label`/`unitId` 不满足恰好其一（xor）形式的选项。
 */
function assertOptionXor(option: { label?: string; unitId?: string }): void {
  const hasLabel = option.label != null && option.label.trim().length > 0;
  const hasUnit = option.unitId != null && option.unitId.length > 0;
  if (hasLabel === hasUnit) {
    throw new PollError(
      "INVALID_OPTION",
      "Each poll option must set exactly one of `label` or `unitId`.",
      400,
    );
  }
}

function parseClosesAt(value: CreatePollInput["closesAt"]): Date | null {
  if (value == null) return null;
  return value instanceof Date ? value : new Date(value);
}

type PollRow = typeof Poll.$inferSelect;
type PollVoteRow = typeof PollVote.$inferSelect;

type NewPollOption = {
  position: string;
  label: string | null;
  unitId: string | null;
};

type CreatePollData = {
  userId: string;
  title: string;
  description: string | null;
  voteMode: "SINGLE" | "MULTI";
  resultVisibility: "LIVE" | "AFTER_CLOSE";
  anonymous: boolean;
  closesAt: Date | null;
  language: string;
  options: NewPollOption[];
};

type VoteIdentity = {
  pollUnitId: string;
  userId: string;
  optionId: string;
};

type PollVoteSelection = {
  optionId: string;
  realmUnitId: string | null;
};

type PollTransactionRepository = {
  findPoll(unitId: string): Promise<PollWithOptions | undefined>;
  findPollRow(unitId: string): Promise<PollRow | undefined>;
  updateVoteMode(unitId: string, voteMode: "SINGLE" | "MULTI"): Promise<void>;
  countVotes(pollUnitId: string): Promise<number>;
  findOption(
    pollUnitId: string,
    optionId: string,
  ): Promise<typeof PollOption.$inferSelect | undefined>;
  findVote(identity: VoteIdentity): Promise<PollVoteRow | undefined>;
  findAnyVoteForUser(
    pollUnitId: string,
    userId: string,
  ): Promise<PollVoteRow | undefined>;
  createVote(input: {
    pollUnitId: string;
    userId: string;
    optionId: string;
    voteMode: "SINGLE" | "MULTI";
    realmUnitId: string | null;
  }): Promise<void>;
  deleteVote(identity: VoteIdentity): Promise<void>;
  incrementOptionVoteCount(
    pollUnitId: string,
    optionId: string,
    delta: 1 | -1,
  ): Promise<void>;
};

export type PollRepository = {
  createPoll(data: CreatePollData): Promise<PollWithOptions>;
  findPoll(unitId: string): Promise<PollWithOptions | undefined>;
  findVotesForUser(
    pollUnitId: string,
    userId: string,
  ): Promise<PollVoteSelection[]>;
  withTransaction<T>(
    callback: (tx: PollTransactionRepository) => Promise<T>,
  ): Promise<T>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

async function hydratePoll(
  database: any,
  poll: PollRow,
): Promise<PollWithOptions> {
  const [unitRows, translationRows, options] = await Promise.all([
    database.select().from(Unit).where(eq(Unit.id, poll.unitId)).limit(1),
    database
      .select()
      .from(UnitTranslation)
      .where(eq(UnitTranslation.unitId, poll.unitId)),
    database
      .select()
      .from(PollOption)
      .where(eq(PollOption.pollUnitId, poll.unitId))
      .orderBy(asc(PollOption.position), asc(PollOption.optionId)),
  ]);

  const unit = unitRows[0];
  return {
    ...poll,
    options,
    unit: unit ? { ...unit, translations: translationRows } : null,
  };
}

function createDrizzlePollTransactionRepository(
  database: any,
): PollTransactionRepository {
  return {
    async findPoll(unitId) {
      const poll = await this.findPollRow(unitId);
      return poll ? hydratePoll(database, poll) : undefined;
    },
    async findPollRow(unitId) {
      const [poll] = await database
        .select()
        .from(Poll)
        .where(eq(Poll.unitId, unitId))
        .limit(1);
      return poll;
    },
    async updateVoteMode(unitId, voteMode) {
      await database
        .update(Poll)
        .set({ voteMode, updatedAt: new Date() })
        .where(eq(Poll.unitId, unitId));
    },
    async countVotes(pollUnitId) {
      const [row] = await database
        .select({ value: sql<number>`count(*)::int` })
        .from(PollVote)
        .where(eq(PollVote.pollUnitId, pollUnitId));
      return row?.value ?? 0;
    },
    async findOption(pollUnitId, optionId) {
      const [option] = await database
        .select()
        .from(PollOption)
        .where(
          and(
            eq(PollOption.pollUnitId, pollUnitId),
            eq(PollOption.optionId, optionId),
          ),
        )
        .limit(1);
      return option;
    },
    async findVote({ pollUnitId, userId, optionId }) {
      const [vote] = await database
        .select()
        .from(PollVote)
        .where(
          and(
            eq(PollVote.pollUnitId, pollUnitId),
            eq(PollVote.userId, userId),
            eq(PollVote.optionId, optionId),
          ),
        )
        .limit(1);
      return vote;
    },
    async findAnyVoteForUser(pollUnitId, userId) {
      const [vote] = await database
        .select()
        .from(PollVote)
        .where(
          and(eq(PollVote.pollUnitId, pollUnitId), eq(PollVote.userId, userId)),
        )
        .limit(1);
      return vote;
    },
    async createVote(input) {
      await database.insert(PollVote).values(input);
    },
    async deleteVote({ pollUnitId, userId, optionId }) {
      await database
        .delete(PollVote)
        .where(
          and(
            eq(PollVote.pollUnitId, pollUnitId),
            eq(PollVote.userId, userId),
            eq(PollVote.optionId, optionId),
          ),
        );
    },
    async incrementOptionVoteCount(pollUnitId, optionId, delta) {
      await database
        .update(PollOption)
        .set({
          voteCount: sql`${PollOption.voteCount} + ${delta}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(PollOption.pollUnitId, pollUnitId),
            eq(PollOption.optionId, optionId),
          ),
        );
    },
  };
}

function createDrizzlePollRepository(): PollRepository {
  return {
    async createPoll(data) {
      const db = await getServerDb();
      return db.transaction(async (tx) => {
        const now = new Date();
        const [unit] = await tx
          .insert(Unit)
          .values({
            userId: data.userId,
            slugScope: data.userId,
            type: "POLL",
            status: "PUBLISHED",
            publishedAt: now,
            defaultLanguage: data.language,
            updatedAt: now,
          })
          .returning({ id: Unit.id });
        if (!unit) {
          throw new PollError("POLL_NOT_FOUND", "Poll not found.", 404);
        }

        await tx.insert(UnitSupportLanguage).values({
          unitId: unit.id,
          language: data.language,
          isPrimary: true,
        });

        await tx.insert(UnitTranslation).values({
          unitId: unit.id,
          language: data.language,
          title: data.title,
          summary: data.description,
          updatedAt: now,
        });

        await tx.insert(Poll).values({
          unitId: unit.id,
          voteMode: data.voteMode,
          resultVisibility: data.resultVisibility,
          anonymous: data.anonymous,
          closesAt: data.closesAt,
          updatedAt: now,
        });

        await tx.insert(PollOption).values(
          data.options.map((option) => ({
            pollUnitId: unit.id,
            position: option.position,
            label: option.label,
            unitId: option.unitId,
            updatedAt: now,
          })),
        );

        const poll = await createDrizzlePollTransactionRepository(tx).findPoll(
          unit.id,
        );
        if (!poll) {
          throw new PollError("POLL_NOT_FOUND", "Poll not found.", 404);
        }
        return poll;
      });
    },
    async findPoll(unitId) {
      const db = await getServerDb();
      const [poll] = await db
        .select()
        .from(Poll)
        .where(eq(Poll.unitId, unitId))
        .limit(1);
      return poll ? hydratePoll(db, poll) : undefined;
    },
    async findVotesForUser(pollUnitId, userId) {
      const db = await getServerDb();
      return db
        .select({
          optionId: PollVote.optionId,
          realmUnitId: PollVote.realmUnitId,
        })
        .from(PollVote)
        .where(
          and(eq(PollVote.pollUnitId, pollUnitId), eq(PollVote.userId, userId)),
        );
    },
    async withTransaction(callback) {
      const db = await getServerDb();
      return db.transaction((tx) =>
        callback(createDrizzlePollTransactionRepository(tx)),
      );
    },
  };
}

export class PollService {
  constructor(
    private readonly repository: PollRepository = createDrizzlePollRepository(),
  ) {}

  /**
   * Create a poll: a `Unit(type=POLL)` plus its `Poll` extension and ≥2
   * `PollOption` rows. Validates the label-xor-unitId invariant per option and
   * assigns fractional positions in request order when not supplied.
   * 创建投票：一个 `Unit(type=POLL)` 加上其 `Poll` 扩展以及至少 2 行
   * `PollOption`。校验每个选项的 label-xor-unitId 不变式，未提供时按请求顺序
   * 分配分数式 position。
   */
  async createPoll(
    userId: string,
    input: CreatePollInput,
  ): Promise<PollWithOptions> {
    if (!input.options || input.options.length < 2) {
      throw new PollError(
        "TOO_FEW_OPTIONS",
        "A poll must have at least two options.",
        400,
      );
    }
    for (const option of input.options) assertOptionXor(option);

    const voteMode = input.voteMode ?? "SINGLE";
    const closesAt = parseClosesAt(input.closesAt);
    const language = input.language ?? DEFAULT_LANGUAGE;

    let lastPosition: string | null = null;
    const options = input.options.map((option) => {
      const position = option.position ?? keyAfter(lastPosition);
      lastPosition = position;
      return {
        position,
        label: option.label ?? null,
        unitId: option.unitId ?? null,
      };
    });

    return this.repository.createPoll({
      userId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      voteMode,
      resultVisibility: input.resultVisibility ?? "LIVE",
      anonymous: input.anonymous ?? false,
      closesAt,
      language,
      options,
    });
  }

  /**
   * Fetch a poll with its options, or throw if it is not a poll.
   * 获取投票及其选项，若不是投票则抛出异常。
   */
  async getPoll(pollUnitId: string): Promise<PollWithOptions> {
    const poll = await this.repository.findPoll(pollUnitId);
    if (!poll) {
      throw new PollError("POLL_NOT_FOUND", "Poll not found.", 404);
    }
    return poll;
  }

  /**
   * Change a poll's vote mode. Rejected once any vote exists, because the two
   * modes carry incompatible exclusivity constraints.
   * 修改投票的投票模式。一旦存在任何投票即被拒绝，因为两种模式带有互不兼容的
   * 互斥约束。
   */
  async changeVoteMode(
    pollUnitId: string,
    voteMode: "SINGLE" | "MULTI",
  ): Promise<PollWithOptions> {
    return this.repository.withTransaction(async (tx) => {
      const poll = await tx.findPollRow(pollUnitId);
      if (!poll) {
        throw new PollError("POLL_NOT_FOUND", "Poll not found.", 404);
      }
      if (poll.voteMode !== voteMode) {
        const voteCount = await tx.countVotes(pollUnitId);
        if (voteCount > 0) {
          throw new PollError(
            "VOTE_MODE_LOCKED",
            "Cannot change vote mode after votes exist.",
            409,
          );
        }
        await tx.updateVoteMode(pollUnitId, voteMode);
      }
      const updated = await tx.findPoll(pollUnitId);
      if (!updated) {
        throw new PollError("POLL_NOT_FOUND", "Poll not found.", 404);
      }
      return updated;
    });
  }

  /**
   * Cast or change a vote, maintaining `PollOption.voteCount` on every change.
   *
   * - SINGLE: the user holds at most one vote; casting a different option moves
   *   it (old row removed, new row inserted) and adjusts both tallies. The
   *   partial unique index guarantees no duplicate row at the DB layer.
   * - MULTI: each (user, option) is an independent row; re-casting the same
   *   option is a no-op.
   * 投票或改票，在每次变更时维护 `PollOption.voteCount`。
   *
   * - SINGLE：用户最多持有一票；投给不同选项会迁移该票（删除旧行、插入新行）
   *   并同时调整两边计数。部分唯一索引在数据库层保证不存在重复行。
   * - MULTI：每个 (user, option) 是独立的一行；重复投同一选项是无操作。
   */
  async castVote(
    userId: string,
    pollUnitId: string,
    optionId: string,
    realmUnitId?: string | null,
  ): Promise<void> {
    await this.repository.withTransaction(async (tx) => {
      const poll = await tx.findPollRow(pollUnitId);
      if (!poll) {
        throw new PollError("POLL_NOT_FOUND", "Poll not found.", 404);
      }
      if (isPollClosed(poll)) {
        throw new PollError(
          "POLL_CLOSED",
          "This poll is closed and no longer accepts votes.",
          409,
        );
      }

      const option = await tx.findOption(pollUnitId, optionId);
      if (!option) {
        throw new PollError(
          "OPTION_NOT_FOUND",
          "Option does not belong to this poll.",
          404,
        );
      }

      if (poll.voteMode === "SINGLE") {
        const existing = await tx.findAnyVoteForUser(pollUnitId, userId);
        if (existing) {
          if (existing.optionId === optionId) return; // no-op — 无操作
          await tx.deleteVote({
            pollUnitId,
            userId,
            optionId: existing.optionId,
          });
          await tx.incrementOptionVoteCount(pollUnitId, existing.optionId, -1);
        }
        await tx.createVote({
          pollUnitId,
          userId,
          optionId,
          voteMode: "SINGLE",
          realmUnitId: realmUnitId ?? null,
        });
        await tx.incrementOptionVoteCount(pollUnitId, optionId, 1);
        return;
      }

      // MULTI
      // 多选模式
      const existing = await tx.findVote({
        pollUnitId,
        userId,
        optionId,
      });
      if (existing) return; // already voted for this option — 已对该选项投过票
      await tx.createVote({
        pollUnitId,
        userId,
        optionId,
        voteMode: "MULTI",
        realmUnitId: realmUnitId ?? null,
      });
      await tx.incrementOptionVoteCount(pollUnitId, optionId, 1);
    });
  }

  /**
   * Withdraw a vote, decrementing the option tally and removing the row.
   * SINGLE polls ignore `optionId` (the user holds one vote); MULTI polls
   * require it.
   * 撤回投票，递减选项计数并删除该行。SINGLE 投票忽略 `optionId`（用户仅持有
   * 一票）；MULTI 投票则要求提供。
   */
  async withdrawVote(
    userId: string,
    pollUnitId: string,
    optionId?: string,
    _realmUnitId?: string | null,
  ): Promise<void> {
    await this.repository.withTransaction(async (tx) => {
      const poll = await tx.findPollRow(pollUnitId);
      if (!poll) {
        throw new PollError("POLL_NOT_FOUND", "Poll not found.", 404);
      }
      if (isPollClosed(poll)) {
        throw new PollError(
          "POLL_CLOSED",
          "This poll is closed and no longer accepts vote changes.",
          409,
        );
      }

      if (poll.voteMode === "MULTI" && !optionId) {
        throw new PollError(
          "WITHDRAW_OPTION_REQUIRED",
          "An option is required to withdraw a vote from a multi-choice poll.",
          400,
        );
      }

      const target = optionId
        ? await tx.findVote({ pollUnitId, userId, optionId })
        : await tx.findAnyVoteForUser(pollUnitId, userId);

      if (!target) return; // nothing to withdraw — 无可撤回的投票

      await tx.deleteVote({
        pollUnitId,
        userId,
        optionId: target.optionId,
      });
      await tx.incrementOptionVoteCount(pollUnitId, target.optionId, -1);
    });
  }

  /**
   * Read poll results with result-visibility and anonymity gating.
   *
   * - `resultsVisible` is true for LIVE polls, and for AFTER_CLOSE polls only
   *   once closed or to a privileged caller (poll owner / admin).
   * - `myVote` is the calling user's own selection and is always returned,
   *   even for anonymous or pre-close polls. The voter↔option mapping for other
   *   users is never read here.
   * 读取投票结果，并施加结果可见性与匿名性的门控。
   *
   * - `resultsVisible` 对 LIVE 投票为 true；对 AFTER_CLOSE 投票仅在已关闭或调用
   *   方具有特权（投票所有者 / 管理员）时为 true。
   * - `myVote` 是调用用户自身的选择，始终返回，即使是匿名或关闭前的投票。这里
   *   绝不读取其他用户的 voter↔option 映射。
   */
  async getResults(
    pollUnitId: string,
    options?: { userId?: string; isPrivileged?: boolean },
  ): Promise<{
    poll: PollWithOptions;
    myVote: string[];
    myVoteContexts: { optionId: string; realmUnitId: string | null }[];
    resultsVisible: boolean;
  }> {
    const poll = await this.getPoll(pollUnitId);

    const closed = isPollClosed(poll);
    const resultsVisible =
      poll.resultVisibility === "LIVE" ||
      closed ||
      options?.isPrivileged === true;

    let myVote: string[] = [];
    let myVoteContexts: { optionId: string; realmUnitId: string | null }[] = [];
    if (options?.userId) {
      const votes = await this.repository.findVotesForUser(
        pollUnitId,
        options.userId,
      );
      myVote = votes.map((v) => v.optionId);
      myVoteContexts = votes.map((vote) => ({
        optionId: vote.optionId,
        realmUnitId: vote.realmUnitId ?? null,
      }));
    }

    return { poll, myVote, myVoteContexts, resultsVisible };
  }
}

export const pollService = new PollService();

import type {
  AttachTagInput,
  CastTagVoteInput,
  CreateTagInput,
  RezicsSessionClaims,
  TagListQuery,
  UpdateTagInput,
} from "@rezics/contract";
import {
  FALLBACK_LANGUAGE,
  mainMarkdownSource,
  parseIdsCsv,
  validateSlug,
} from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  lte,
  sql,
} from "drizzle-orm";
import { serverJobProducer } from "@/job/job-boundary";
import { TagVote, Unit, UnitTag, UnitTranslation } from "../db/schema";
import type { TagWithTranslations, UnitTagWithRelations } from "./types";

/**
 * Score at or below this threshold hides a UnitTag from regular users.
 * 分数等于或低于此阈值时，对普通用户隐藏该 UnitTag。
 */
export const VISIBILITY_THRESHOLD = -100;

type UnitTagRow = typeof UnitTag.$inferSelect;

type TagRepository = {
  listTags(query: TagListQuery): Promise<{
    tags: TagWithTranslations[];
    total: number;
  }>;
  getTag(unitId: string): Promise<TagWithTranslations>;
  createTag(
    userId: string,
    input: CreateTagInput & { slug?: string },
    slugScope: string,
  ): Promise<TagWithTranslations>;
  updateTranslations(unitId: string, input: UpdateTagInput): Promise<void>;
  updateVisual(
    unitId: string,
    input: Pick<UpdateTagInput, "visual">,
  ): Promise<void>;
  deleteTag(unitId: string): Promise<void>;
  createUnitTag(
    userId: string,
    unitId: string,
    tagUnitId: string,
  ): Promise<UnitTagRow>;
  setUnitTagPin(
    unitId: string,
    tagUnitId: string,
    input: { pinned?: boolean; position?: string | null },
  ): Promise<UnitTagRow>;
  deleteUnitTag(unitId: string, tagUnitId: string): Promise<void>;
  castVote(
    userId: string,
    unitId: string,
    tagUnitId: string,
    value: number,
  ): Promise<void>;
  withdrawVote(
    userId: string,
    unitId: string,
    tagUnitId: string,
  ): Promise<void>;
  getTagsForUnit(
    unitId: string,
    options?: { includeBelowThreshold?: boolean },
  ): Promise<UnitTagWithRelations[]>;
  getViewerVotesForUnit(
    userId: string,
    unitId: string,
    tagUnitIds: string[],
  ): Promise<Map<string, number>>;
  listLowScoreUnitTags(threshold: number, limit: number): Promise<UnitTagRow[]>;
  batchTranslations(
    tagUnitIds: string[],
    language: string,
  ): Promise<
    Record<string, { name: string; slug: string; description: string }>
  >;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function enqueueContentTagsSync(unitId: string) {
  const source = { type: "server" as const, service: "tag" };
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.contentPatchTags,
      { unitId },
      source,
    ),
  );
}

function enqueueTagSearchSync(unitId: string) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.tagSync,
      { unitId },
      { type: "server", service: "tag" },
    ),
  );
}

function enqueueTagSearchDelete(unitId: string) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.tagDelete,
      { unitId },
      { type: "server", service: "tag" },
    ),
  );
}

async function loadTagTranslations(
  db: any,
  tagUnitIds: readonly string[],
): Promise<Map<string, Array<typeof UnitTranslation.$inferSelect>>> {
  const ids = Array.from(new Set(tagUnitIds));
  if (ids.length === 0) return new Map();

  const rows = await db
    .select()
    .from(UnitTranslation)
    .where(inArray(UnitTranslation.unitId, ids))
    .orderBy(asc(UnitTranslation.language));
  const byUnit = new Map<string, Array<typeof UnitTranslation.$inferSelect>>();
  for (const row of rows) {
    const list = byUnit.get(row.unitId) ?? [];
    list.push(row);
    byUnit.set(row.unitId, list);
  }
  return byUnit;
}

async function hydrateTags(
  db: any,
  rows: Array<typeof Unit.$inferSelect>,
): Promise<TagWithTranslations[]> {
  const translations = await loadTagTranslations(
    db,
    rows.map((row) => row.id),
  );
  return rows.map((row) => ({
    ...row,
    translations: translations.get(row.id) ?? [],
  }));
}

async function hydrateUnitTags(
  db: any,
  rows: UnitTagRow[],
): Promise<UnitTagWithRelations[]> {
  const tagIds = rows.map((row) => row.tagUnitId);
  const tagRows =
    tagIds.length === 0
      ? []
      : await db.select().from(Unit).where(inArray(Unit.id, tagIds));
  const translations = await loadTagTranslations(db, tagIds);
  const tagsById = new Map<string, UnitTagWithRelations["tag"]>(
    tagRows.map((tag: typeof Unit.$inferSelect) => [
      tag.id,
      { ...tag, translations: translations.get(tag.id) ?? [] },
    ]),
  );
  return rows.map((row) => {
    const tag = tagsById.get(row.tagUnitId);
    if (!tag) throw new Error(`Tag Unit not found: ${row.tagUnitId}`);
    return { ...row, tag };
  });
}

function createDrizzleTagRepository(): TagRepository {
  return {
    async listTags(query) {
      const db = await getServerDb();
      const page = Math.max(Number(query.page ?? 1), 1);
      const limit = Math.max(1, Math.min(Number(query.limit ?? 20), 100));
      const skip = (page - 1) * limit;
      const conditions = [eq(Unit.type, "TAG"), eq(Unit.status, "PUBLISHED")];

      const idList = parseIdsCsv(query.ids);
      if (idList && idList.length > 0) {
        conditions.push(inArray(Unit.id, idList));
      }

      if (query.q?.trim() || query.language) {
        const translationConditions = [];
        if (query.q?.trim()) {
          translationConditions.push(
            ilike(UnitTranslation.title, `%${query.q.trim()}%`),
          );
        }
        if (query.language) {
          translationConditions.push(
            eq(UnitTranslation.language, query.language),
          );
        }
        const matchingTranslations = await db
          .select({ unitId: UnitTranslation.unitId })
          .from(UnitTranslation)
          .where(and(...translationConditions));
        const matchingIds = [
          ...new Set(matchingTranslations.map((row) => row.unitId)),
        ];
        if (matchingIds.length === 0) return { tags: [], total: 0 };
        conditions.push(inArray(Unit.id, matchingIds));
      }

      const where = and(...conditions);
      const [rows, totalRows] = await Promise.all([
        db
          .select()
          .from(Unit)
          .where(where)
          .orderBy(desc(Unit.createdAt))
          .offset(skip)
          .limit(limit),
        db.select({ total: count() }).from(Unit).where(where),
      ]);
      const tags = await hydrateTags(db, rows);
      return { tags, total: Number(totalRows[0]?.total ?? 0) };
    },

    async getTag(unitId) {
      const db = await getServerDb();
      const [row] = await db
        .select()
        .from(Unit)
        .where(and(eq(Unit.id, unitId), eq(Unit.type, "TAG")))
        .limit(1);
      if (!row) throw new Error(`No Unit found for ${unitId}`);
      return (await hydrateTags(db, [row]))[0]!;
    },

    async createTag(userId, input, slugScope) {
      const db = await getServerDb();
      const tag = await db.transaction(async (tx) => {
        const [unit] = await tx
          .insert(Unit)
          .values({
            type: "TAG",
            slugScope,
            status: "PUBLISHED",
            isLanguageNeutral: true,
            userId,
            slug: input.slug,
            extra: input.visual ? { tagVisual: input.visual } : null,
            updatedAt: new Date(),
          })
          .returning();
        if (!unit) throw new Error("Failed to create tag Unit");

        if (input.translations.length > 0) {
          await tx.insert(UnitTranslation).values(
            input.translations.map((translation) => ({
              unitId: unit.id,
              language: translation.language,
              title: translation.title,
              updatedAt: new Date(),
            })),
          );
        }
        return unit;
      });
      return (await hydrateTags(db, [tag]))[0]!;
    },

    async updateTranslations(unitId, input) {
      if (!input.translations || input.translations.length === 0) return;
      const db = await getServerDb();
      await Promise.all(
        input.translations.map((translation) =>
          db
            .insert(UnitTranslation)
            .values({
              unitId,
              language: translation.language,
              title: translation.title,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [UnitTranslation.unitId, UnitTranslation.language],
              set: { title: translation.title, updatedAt: new Date() },
            }),
        ),
      );
    },

    async updateVisual(unitId, input) {
      if (input.visual === undefined) return;
      const db = await getServerDb();
      const [row] = await db
        .select({ extra: Unit.extra })
        .from(Unit)
        .where(and(eq(Unit.id, unitId), eq(Unit.type, "TAG")))
        .limit(1);
      if (!row) throw new Error(`No Unit found for ${unitId}`);
      const current =
        row.extra && typeof row.extra === "object" && !Array.isArray(row.extra)
          ? { ...(row.extra as Record<string, unknown>) }
          : {};
      if (input.visual === null) {
        delete current.tagVisual;
      } else {
        current.tagVisual = input.visual;
      }
      await db
        .update(Unit)
        .set({
          extra: Object.keys(current).length > 0 ? current : null,
          updatedAt: new Date(),
        })
        .where(and(eq(Unit.id, unitId), eq(Unit.type, "TAG")));
    },

    async deleteTag(unitId) {
      const db = await getServerDb();
      await db.delete(Unit).where(eq(Unit.id, unitId));
    },

    async createUnitTag(userId, unitId, tagUnitId) {
      const db = await getServerDb();
      return db.transaction(async (tx) => {
        await tx
          .insert(TagVote)
          .values({ userId, unitId, tagUnitId, value: 1 })
          .onConflictDoNothing({
            target: [TagVote.userId, TagVote.unitId, TagVote.tagUnitId],
          });

        const agg = await aggregateTagVotes(tx, unitId, tagUnitId);
        return upsertUnitTag(tx, unitId, tagUnitId, agg);
      });
    },

    async setUnitTagPin(unitId, tagUnitId, input) {
      const db = await getServerDb();
      const data: { pinned?: boolean; position?: string | null } = {};
      if (input.pinned !== undefined) {
        data.pinned = input.pinned;
        if (input.pinned === false) data.position = null;
      }
      if (input.position !== undefined) data.position = input.position;

      const [updated] = await db
        .update(UnitTag)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(eq(UnitTag.unitId, unitId), eq(UnitTag.tagUnitId, tagUnitId)),
        )
        .returning();
      if (!updated) throw new Error("UnitTag not found");
      return updated;
    },

    async deleteUnitTag(unitId, tagUnitId) {
      const db = await getServerDb();
      await db.transaction(async (tx) => {
        await tx
          .delete(TagVote)
          .where(
            and(eq(TagVote.unitId, unitId), eq(TagVote.tagUnitId, tagUnitId)),
          );
        await tx
          .delete(UnitTag)
          .where(
            and(eq(UnitTag.unitId, unitId), eq(UnitTag.tagUnitId, tagUnitId)),
          );
      });
    },

    async castVote(userId, unitId, tagUnitId, value) {
      const db = await getServerDb();
      const clampedValue = value > 0 ? 1 : -1;
      await db.transaction(async (tx) => {
        await tx
          .insert(TagVote)
          .values({ userId, unitId, tagUnitId, value: clampedValue })
          .onConflictDoUpdate({
            target: [TagVote.userId, TagVote.unitId, TagVote.tagUnitId],
            set: { value: clampedValue },
          });

        const agg = await aggregateTagVotes(tx, unitId, tagUnitId);
        await tx
          .update(UnitTag)
          .set({
            score: agg.score,
            voteCount: agg.voteCount,
            updatedAt: new Date(),
          })
          .where(
            and(eq(UnitTag.unitId, unitId), eq(UnitTag.tagUnitId, tagUnitId)),
          );
      });
    },

    async withdrawVote(userId, unitId, tagUnitId) {
      const db = await getServerDb();
      await db.transaction(async (tx) => {
        await tx
          .delete(TagVote)
          .where(
            and(
              eq(TagVote.userId, userId),
              eq(TagVote.unitId, unitId),
              eq(TagVote.tagUnitId, tagUnitId),
            ),
          );

        const agg = await aggregateTagVotes(tx, unitId, tagUnitId);
        if (agg.voteCount === 0) {
          await tx
            .delete(UnitTag)
            .where(
              and(eq(UnitTag.unitId, unitId), eq(UnitTag.tagUnitId, tagUnitId)),
            );
          return;
        }

        await upsertUnitTag(tx, unitId, tagUnitId, agg);
      });
    },

    async getTagsForUnit(unitId, options) {
      const db = await getServerDb();
      const rows = await db
        .select()
        .from(UnitTag)
        .where(
          options?.includeBelowThreshold
            ? eq(UnitTag.unitId, unitId)
            : and(
                eq(UnitTag.unitId, unitId),
                gt(UnitTag.score, VISIBILITY_THRESHOLD),
              ),
        )
        .orderBy(
          desc(UnitTag.pinned),
          asc(UnitTag.position),
          desc(UnitTag.score),
          asc(UnitTag.tagUnitId),
        );
      return hydrateUnitTags(db, rows);
    },

    async getViewerVotesForUnit(userId, unitId, tagUnitIds) {
      if (tagUnitIds.length === 0) return new Map();
      const db = await getServerDb();
      const rows = await db
        .select({
          tagUnitId: TagVote.tagUnitId,
          value: TagVote.value,
        })
        .from(TagVote)
        .where(
          and(
            eq(TagVote.userId, userId),
            eq(TagVote.unitId, unitId),
            inArray(TagVote.tagUnitId, tagUnitIds),
          ),
        );
      return new Map(rows.map((row) => [row.tagUnitId, row.value]));
    },

    async listLowScoreUnitTags(threshold, limit) {
      const db = await getServerDb();
      return db
        .select()
        .from(UnitTag)
        .where(lte(UnitTag.score, threshold))
        .orderBy(
          asc(UnitTag.score),
          asc(UnitTag.unitId),
          asc(UnitTag.tagUnitId),
        )
        .limit(Math.max(1, Math.min(limit, 200)));
    },

    async batchTranslations(tagUnitIds, language) {
      if (tagUnitIds.length === 0) return {};
      const db = await getServerDb();
      const rows = await db
        .select()
        .from(Unit)
        .where(and(inArray(Unit.id, tagUnitIds), eq(Unit.type, "TAG")));
      const tags = await hydrateTags(db, rows);

      const result: Record<
        string,
        { name: string; slug: string; description: string }
      > = {};
      for (const tag of tags) {
        const translations = tag.translations ?? [];
        const requested = translations.find(
          (translation) =>
            translation.language === language && translation.title,
        );
        const defaultLang = tag.defaultLanguage;
        const byDefault = defaultLang
          ? translations.find(
              (translation) =>
                translation.language === defaultLang && translation.title,
            )
          : undefined;
        const byFallback = translations.find(
          (translation) =>
            translation.language === FALLBACK_LANGUAGE && translation.title,
        );
        const first = translations.find((translation) => translation.title);
        const pick = requested ?? byDefault ?? byFallback ?? first;

        result[tag.id] = {
          name: pick?.title ?? "",
          slug: tag.slug ?? "",
          description: mainMarkdownSource(pick?.description) ?? "",
        };
      }
      return result;
    },
  };
}

async function aggregateTagVotes(
  tx: any,
  unitId: string,
  tagUnitId: string,
): Promise<{ score: number; voteCount: number }> {
  const [agg] = await tx
    .select({
      score: sql<number>`coalesce(sum(${TagVote.value}), 0)`,
      voteCount: count(TagVote.value),
    })
    .from(TagVote)
    .where(and(eq(TagVote.unitId, unitId), eq(TagVote.tagUnitId, tagUnitId)));
  return {
    score: Number(agg?.score ?? 0),
    voteCount: Number(agg?.voteCount ?? 0),
  };
}

async function upsertUnitTag(
  tx: any,
  unitId: string,
  tagUnitId: string,
  agg: { score: number; voteCount: number },
): Promise<UnitTagRow> {
  const [row] = await tx
    .insert(UnitTag)
    .values({
      unitId,
      tagUnitId,
      score: agg.score,
      voteCount: agg.voteCount,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [UnitTag.unitId, UnitTag.tagUnitId],
      set: {
        score: agg.score,
        voteCount: agg.voteCount,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!row) throw new Error("Failed to upsert UnitTag");
  return row;
}

export class TagService {
  constructor(
    private readonly repository: TagRepository = createDrizzleTagRepository(),
  ) {}

  /**
   * List tag Units, optionally filtered by name search and language.
   * 列出标签 Unit，可按名称搜索和语言进行过滤。
   */
  async list(query: TagListQuery = {}): Promise<{
    tags: TagWithTranslations[];
    total: number;
  }> {
    return this.repository.listTags(query);
  }

  /**
   * Get a single tag Unit by its id, including translations.
   * 根据 id 获取单个标签 Unit，包含其翻译。
   */
  async getByUnitId(unitId: string): Promise<TagWithTranslations> {
    return this.repository.getTag(unitId);
  }

  /**
   * Create a new tag Unit with translations.
   * Tags are always isLanguageNeutral=true and type=TAG.
   * 创建一个带翻译的新标签 Unit。
   * 标签始终为 isLanguageNeutral=true 且 type=TAG。
   */
  async create(
    userId: string,
    input: CreateTagInput & { slug?: string },
  ): Promise<TagWithTranslations> {
    let normalizedSlug: string | undefined;
    if (input.slug) {
      const validation = validateSlug(input.slug, { scope: "tag" });
      if (!validation.ok) throw new Error(`Invalid slug: ${validation.reason}`);
      normalizedSlug = validation.normalized;
    }

    const { requireSlugScopeId } = await import("@/infra/slug-scopes");
    const tagScope = requireSlugScopeId("tag");
    const tag = await this.repository.createTag(
      userId,
      { ...input, slug: normalizedSlug },
      tagScope,
    );
    await enqueueTagSearchSync(tag.id);
    return tag;
  }

  /**
   * Update a tag's translations (upsert each provided translation).
   * 更新标签的翻译（对每条提供的翻译执行 upsert）。
   */
  async update(
    unitId: string,
    input: UpdateTagInput,
  ): Promise<TagWithTranslations> {
    await this.repository.updateTranslations(unitId, input);
    await this.repository.updateVisual(unitId, input);
    const tag = await this.getByUnitId(unitId);
    await enqueueTagSearchSync(unitId);
    return tag;
  }

  /**
   * Delete a tag Unit (cascades to UnitTag, TagVote via DB).
   * 删除一个标签 Unit（通过数据库级联删除 UnitTag、TagVote）。
   */
  async delete(unitId: string): Promise<void> {
    await this.repository.deleteTag(unitId);
    await enqueueTagSearchDelete(unitId);
  }

  /**
   * Create a UnitTag with creation-as-vote semantics.
   * 以“创建即投票”语义创建一个 UnitTag。
   *
   * - First call: writes the UnitTag (score=1, voteCount=1) and a +1 TagVote.
   * - Subsequent distinct-user calls: insert a TagVote and recompute score/voteCount.
   * - Idempotent for the same user: existing TagVote is left untouched.
   * - 首次调用：写入 UnitTag（score=1, voteCount=1）以及一条 +1 的 TagVote。
   * - 不同用户的后续调用：插入一条 TagVote 并重新计算 score/voteCount。
   * - 对同一用户幂等：已存在的 TagVote 保持不变。
   */
  async createUnitTag(
    userId: string,
    unitId: string,
    tagUnitId: string,
    _actor?: RezicsSessionClaims,
  ): Promise<UnitTagRow> {
    const result = await this.repository.createUnitTag(
      userId,
      unitId,
      tagUnitId,
    );
    await enqueueContentTagsSync(unitId);
    return result;
  }

  /**
   * Set pin/position on a UnitTag. Authorization is enforced by the route.
   * `position` may be null to clear it; `pinned=false` clears `position` too.
   * 设置 UnitTag 的 pin/position。授权由路由层强制执行。
   * `position` 可为 null 以清除它；`pinned=false` 同样会清除 `position`。
   */
  async setUnitTagPin(
    unitId: string,
    tagUnitId: string,
    input: { pinned?: boolean; position?: string | null },
    _actor?: RezicsSessionClaims,
  ): Promise<UnitTagRow> {
    const updated = await this.repository.setUnitTagPin(
      unitId,
      tagUnitId,
      input,
    );
    await enqueueContentTagsSync(unitId);
    return updated;
  }

  /**
   * Delete a UnitTag and the underlying TagVote rows for that pair.
   * 删除一个 UnitTag 以及该配对对应的底层 TagVote 行。
   */
  async deleteUnitTag(
    unitId: string,
    tagUnitId: string,
    _actor?: RezicsSessionClaims,
  ): Promise<void> {
    await this.repository.deleteUnitTag(unitId, tagUnitId);
    await enqueueContentTagsSync(unitId);
  }

  /**
   * Cast a vote on a tag-unit association.
   * Upserts the TagVote and recalculates the UnitTag score and voteCount.
   * 对一个标签-unit 关联投票。
   * 对 TagVote 执行 upsert，并重新计算 UnitTag 的 score 和 voteCount。
   */
  async castVote(
    userId: string,
    unitId: string,
    tagUnitId: string,
    value: number,
  ): Promise<void> {
    await this.repository.castVote(userId, unitId, tagUnitId, value);
    await enqueueContentTagsSync(unitId);
  }

  /**
   * Withdraw the caller's own tag vote. If no votes remain, remove the
   * aggregate UnitTag row because the tag is no longer applied by anyone.
   * 撤回调用者自己的标签投票。若没有剩余投票，则删除聚合 UnitTag 行，
   * 因为该标签已不再被任何人应用到该 unit。
   */
  async withdrawVote(
    userId: string,
    unitId: string,
    tagUnitId: string,
  ): Promise<void> {
    await this.repository.withdrawVote(userId, unitId, tagUnitId);
    await enqueueContentTagsSync(unitId);
  }

  /**
   * Compatibility wrapper for older attach-tag call sites.
   * 为旧的 attach-tag 调用点提供的兼容性包装。
   */
  async attach(
    userId: string,
    input: AttachTagInput,
    actor?: RezicsSessionClaims,
  ): Promise<UnitTagRow> {
    return this.createUnitTag(userId, input.unitId, input.tagUnitId, actor);
  }

  /**
   * Compatibility wrapper for vote input objects.
   * 为投票输入对象提供的兼容性包装。
   */
  async vote(userId: string, input: CastTagVoteInput): Promise<void> {
    await this.castVote(userId, input.unitId, input.tagUnitId, input.value);
  }

  /**
   * Get UnitTag rows for a given unit, ordered pin-first then score-desc.
   * 获取指定 unit 的 UnitTag 行，按置顶优先、然后按分数降序排列。
   *
   * Regular callers do not see rows with `score <= VISIBILITY_THRESHOLD`.
   * Privileged callers (platform admin / unit owner) see them so the route
   * can flag them with `belowVisibilityThreshold`.
   * 普通调用方看不到 `score <= VISIBILITY_THRESHOLD` 的行。
   * 特权调用方（平台管理员 / unit 所有者）可以看到它们，以便路由层
   * 用 `belowVisibilityThreshold` 对其进行标记。
   */
  async getTagsForUnit(
    unitId: string,
    options?: { includeBelowThreshold?: boolean },
  ): Promise<UnitTagWithRelations[]> {
    return this.repository.getTagsForUnit(unitId, options);
  }

  async getViewerVotesForUnit(
    userId: string,
    unitId: string,
    tagUnitIds: string[],
  ): Promise<Map<string, number>> {
    return this.repository.getViewerVotesForUnit(userId, unitId, tagUnitIds);
  }

  /**
   * Admin-only discovery: list UnitTag rows at or below the given score
   * threshold, ordered ascending so the worst offenders surface first.
   * 仅管理员可用的发现接口：列出分数等于或低于给定阈值的 UnitTag 行，
   * 按升序排列，使问题最严重的项最先出现。
   */
  async listLowScoreUnitTags(
    threshold: number,
    limit: number,
  ): Promise<UnitTagRow[]> {
    return this.repository.listLowScoreUnitTags(threshold, limit);
  }

  /**
   * Resolve display translations for a batch of tag unit IDs in the requested language.
   * Uses the standard translation resolution chain (requested -> unit default -> platform fallback -> first).
   * 为一批标签 unit ID 解析所请求语言下的展示翻译。
   * 使用标准翻译解析链（请求语言 -> unit 默认语言 -> 平台回退语言 -> 第一条）。
   */
  async batchTranslations(
    tagUnitIds: string[],
    language: string,
  ): Promise<
    Record<string, { name: string; slug: string; description: string }>
  > {
    return this.repository.batchTranslations(tagUnitIds, language);
  }
}

export const tagService = new TagService();

import type { ActivityItem, PostKind } from "@rezics/contract";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { profileReactionHistoryService } from "@/profile-reaction-history/profile-reaction-history.service";
import { db } from "../db/client";
import {
  Post,
  Shelf,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
} from "../db/schema";
import {
  mergeActivity,
  postActivityHref,
  postActivityKind,
  resolvePostActivityTitle,
  shelfActivityHref,
} from "./activity.mapper";

const ACTIVITY_POST_KINDS = [
  "POST",
  "REVIEW",
  "REMARK",
] as const satisfies readonly PostKind[];
const PUBLIC_UNIT_STATUS = "PUBLISHED";
const PUBLIC_UNIT_VISIBILITY = "PUBLIC";
const PUBLIC_UNIT_MODERATION_STATUS = "APPROVED";

type PostActivityRow = {
  unitId: string;
  kind: string | null;
  createdAt: Date;
  extra: unknown;
  defaultLanguage: string | null;
};

type ShelfActivityRow = {
  unitId: string;
  updatedAt: Date;
};

type TranslationRow = {
  unitId: string;
  language: string;
  title: string | null;
};

type SupportLanguageRow = {
  unitId: string;
  language: string;
  isPrimary: boolean;
  position: string;
};

function publicUnitPredicate() {
  return and(
    eq(Unit.status, PUBLIC_UNIT_STATUS),
    eq(Unit.visibility, PUBLIC_UNIT_VISIBILITY),
    eq(Unit.moderationStatus, PUBLIC_UNIT_MODERATION_STATUS),
  );
}

function groupRowsByUnitId<T extends { unitId: string }>(
  rows: readonly T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const list = grouped.get(row.unitId);
    if (list) {
      list.push(row);
    } else {
      grouped.set(row.unitId, [row]);
    }
  }
  return grouped;
}

async function loadPostActivityRows(options: {
  profileUserId: string;
  before: Date | null;
  take: number;
}): Promise<{
  posts: PostActivityRow[];
  translations: Map<string, TranslationRow[]>;
  supportLanguages: Map<string, SupportLanguageRow[]>;
}> {
  const posts = await db
    .select({
      unitId: Post.unitId,
      kind: Post.kind,
      createdAt: Post.createdAt,
      extra: Post.extra,
      defaultLanguage: Unit.defaultLanguage,
    })
    .from(Post)
    .innerJoin(Unit, eq(Unit.id, Post.unitId))
    .where(
      and(
        eq(Post.authorUserId, options.profileUserId),
        inArray(Post.kind, [...ACTIVITY_POST_KINDS]),
        publicUnitPredicate(),
        options.before ? lt(Post.createdAt, options.before) : undefined,
      ),
    )
    .orderBy(desc(Post.createdAt))
    .limit(options.take);

  const unitIds = posts.map((post) => post.unitId);
  if (unitIds.length === 0) {
    return {
      posts,
      translations: new Map(),
      supportLanguages: new Map(),
    };
  }

  const [translations, supportLanguages] = await Promise.all([
    db
      .select({
        unitId: UnitTranslation.unitId,
        language: UnitTranslation.language,
        title: UnitTranslation.title,
      })
      .from(UnitTranslation)
      .where(inArray(UnitTranslation.unitId, unitIds)),
    db
      .select({
        unitId: UnitSupportLanguage.unitId,
        language: UnitSupportLanguage.language,
        isPrimary: UnitSupportLanguage.isPrimary,
        position: UnitSupportLanguage.position,
      })
      .from(UnitSupportLanguage)
      .where(inArray(UnitSupportLanguage.unitId, unitIds)),
  ]);

  return {
    posts,
    translations: groupRowsByUnitId(translations),
    supportLanguages: groupRowsByUnitId(supportLanguages),
  };
}

async function loadShelfActivityRows(options: {
  profileUserId: string;
  before: Date | null;
  take: number;
}): Promise<{
  shelves: ShelfActivityRow[];
  translations: Map<string, TranslationRow[]>;
}> {
  const shelves = await db
    .select({
      unitId: Shelf.unitId,
      updatedAt: Shelf.updatedAt,
    })
    .from(Shelf)
    .innerJoin(Unit, eq(Unit.id, Shelf.unitId))
    .where(
      and(
        eq(Unit.userId, options.profileUserId),
        publicUnitPredicate(),
        options.before ? lt(Shelf.updatedAt, options.before) : undefined,
      ),
    )
    .orderBy(desc(Shelf.updatedAt))
    .limit(options.take);

  const unitIds = shelves.map((shelf) => shelf.unitId);
  if (unitIds.length === 0) {
    return { shelves, translations: new Map() };
  }

  const translations = await db
    .select({
      unitId: UnitTranslation.unitId,
      language: UnitTranslation.language,
      title: UnitTranslation.title,
    })
    .from(UnitTranslation)
    .where(inArray(UnitTranslation.unitId, unitIds));

  return {
    shelves,
    translations: groupRowsByUnitId(translations),
  };
}

export const activityService = {
  /**
   * Time-ordered public activity for a profile: the user's posts/reviews/
   * remarks, given reactions, and shelf updates. Each source filters to
   * publicly eligible (published + public) subjects, so removed or private
   * content is omitted server-side rather than leaked as a gap.
   *
   * Reactions live in a separate service with an opaque cursor; v1 overlays
   * the most recent reaction window and filters it by the `before` watermark,
   * so reaction history deeper than that window is not paginated yet.
   *
   * 按时间排序的个人主页公开动态：用户的 posts/reviews/remarks、给出的 reactions
   * 以及书架更新。每个来源都过滤为公开可见（已发布 + 公开）的对象，因此被移除或私密的
   * 内容在服务端被省略，而不会以空缺形式泄露。
   *
   * Reactions 位于带有不透明游标的独立服务中；v1 叠加最近的 reaction 窗口，并按
   * `before` 水位线过滤，因此超出该窗口的更早 reaction 历史尚未分页。
   */
  async listForUser(opts: {
    profileUserId: string;
    viewerUserId: string | null;
    before?: string;
    limit?: number;
  }): Promise<{ items: ActivityItem[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
    const before = opts.before ? new Date(opts.before) : null;
    const beforeValid =
      before && !Number.isNaN(before.getTime()) ? before : null;

    const [posts, shelves, reactionPage] = await Promise.all([
      loadPostActivityRows({
        profileUserId: opts.profileUserId,
        before: beforeValid,
        take: limit + 1,
      }),
      loadShelfActivityRows({
        profileUserId: opts.profileUserId,
        before: beforeValid,
        take: limit + 1,
      }),
      // Asserts profile viewability and hydrates target title/href.
      // 断言个人主页可见性，并填充目标的 title/href。
      profileReactionHistoryService.listGiven({
        profileUserId: opts.profileUserId,
        viewerUserId: opts.viewerUserId,
        limit: limit + 1,
      }),
    ]);

    const postItems: ActivityItem[] = posts.posts.map((p) => {
      const kind = postActivityKind(p.kind);
      const title =
        resolvePostActivityTitle({
          translations: posts.translations.get(p.unitId) ?? [],
          defaultLanguage: p.defaultLanguage,
          supportLanguages: posts.supportLanguages.get(p.unitId) ?? [],
          extra: p.extra,
        }) ?? "";
      return {
        id: p.unitId,
        kind,
        title,
        href: postActivityHref(kind, p.unitId),
        at: p.createdAt.toISOString(),
      };
    });

    const shelfItems: ActivityItem[] = shelves.shelves.map((s) => ({
      id: s.unitId,
      kind: "shelf",
      title: shelves.translations.get(s.unitId)?.[0]?.title ?? "",
      href: shelfActivityHref(s.unitId),
      at: s.updatedAt.toISOString(),
    }));

    const reactionItems: ActivityItem[] = reactionPage.items
      .filter((r) => (beforeValid ? new Date(r.createdAt) < beforeValid : true))
      .map((r) => ({
        id: r.id,
        kind: "reaction",
        title: r.target?.title ?? "",
        href: r.target?.href ?? "/",
        at: r.createdAt,
        reaction: r.reaction,
      }));

    return mergeActivity(
      [...postItems, ...shelfItems, ...reactionItems],
      limit,
    );
  },
};

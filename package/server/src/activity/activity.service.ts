import type { ActivityItem } from "@rezics/contract";
import { PostKind, prisma } from "#/prisma/client";
import { profileReactionHistoryService } from "@/profile-reaction-history/profile-reaction-history.service";
import { publicUnitEligibilityWhere } from "@/unit/publication-policy";
import {
  mergeActivity,
  postActivityHref,
  postActivityKind,
  resolvePostActivityTitle,
  shelfActivityHref,
} from "./activity.mapper";

const ACTIVITY_POST_KINDS = [PostKind.POST, PostKind.REVIEW, PostKind.REMARK];

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
      prisma.post.findMany({
        where: {
          authorUserId: opts.profileUserId,
          kind: { in: ACTIVITY_POST_KINDS },
          unit: { ...publicUnitEligibilityWhere },
          ...(beforeValid ? { createdAt: { lt: beforeValid } } : {}),
        },
        select: {
          unitId: true,
          kind: true,
          createdAt: true,
          extra: true,
          unit: {
            select: {
              defaultLanguage: true,
              translations: { select: { language: true, title: true } },
              supportLanguages: {
                select: { language: true, isPrimary: true, sortOrder: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
      }),
      prisma.shelf.findMany({
        where: {
          unit: { userId: opts.profileUserId, ...publicUnitEligibilityWhere },
          ...(beforeValid ? { updatedAt: { lt: beforeValid } } : {}),
        },
        select: {
          unitId: true,
          updatedAt: true,
          unit: {
            select: { translations: { select: { title: true }, take: 1 } },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: limit + 1,
      }),
      // Asserts profile viewability and hydrates target title/href.
      profileReactionHistoryService.listGiven({
        profileUserId: opts.profileUserId,
        viewerUserId: opts.viewerUserId,
        limit: limit + 1,
      }),
    ]);

    const postItems: ActivityItem[] = posts.map((p) => {
      const kind = postActivityKind(p.kind);
      const title =
        resolvePostActivityTitle({
          translations: p.unit?.translations ?? [],
          defaultLanguage: p.unit?.defaultLanguage,
          supportLanguages: p.unit?.supportLanguages,
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

    const shelfItems: ActivityItem[] = shelves.map((s) => ({
      id: s.unitId,
      kind: "shelf",
      title: s.unit?.translations[0]?.title ?? "",
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

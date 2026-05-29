import {
  contentDocMarkdownFallback,
  type DraftMetadata,
} from "@rezics/contract";
import { PostKind, prisma, UnitStatus } from "#/prisma/client";
import { postKindToDraftKind, toDraftMetadata } from "./draft.mapper";

/** Draft-eligible post kinds (reply/excerpt/chapter never become drafts). */
const DRAFT_POST_KINDS = [
  PostKind.REVIEW,
  PostKind.REMARK,
  PostKind.POST,
  PostKind.WIKI,
];

/** Collapse a ContentDoc to a single line of plain text, trimmed. */
function plainText(content: unknown): string {
  return contentDocMarkdownFallback(content)
    .replace(/[#*_>`~\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveTitle(extra: unknown, content: unknown): string {
  const extraTitle =
    extra && typeof extra === "object"
      ? (extra as { title?: unknown }).title
      : undefined;
  if (typeof extraTitle === "string" && extraTitle.trim()) {
    return extraTitle.trim().slice(0, 120);
  }
  const text = plainText(content);
  return text ? text.slice(0, 80) : "";
}

function deriveExcerpt(content: unknown): string | undefined {
  const text = plainText(content);
  return text ? text.slice(0, 200) : undefined;
}

export const draftService = {
  /**
   * List the user's draft-status posts across draft-eligible kinds, newest
   * first. Reuses the existing `Unit.status = DRAFT` storage; no separate
   * draft table.
   */
  async listMine(
    userId: string,
    query?: { limit?: number },
  ): Promise<DraftMetadata[]> {
    const take = Math.max(1, Math.min(query?.limit ?? 50, 100));
    const posts = await prisma.post.findMany({
      where: {
        authorUserId: userId,
        kind: { in: DRAFT_POST_KINDS },
        unit: { status: UnitStatus.DRAFT },
      },
      select: {
        unitId: true,
        kind: true,
        content: true,
        extra: true,
        targetUnitId: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take,
    });

    const drafts: DraftMetadata[] = [];
    for (const post of posts) {
      const kind = postKindToDraftKind(post.kind);
      if (!kind) continue;
      drafts.push(
        toDraftMetadata({
          unitId: post.unitId,
          kind,
          title: deriveTitle(post.extra, post.content),
          excerpt: deriveExcerpt(post.content),
          updatedAt: post.updatedAt.toISOString(),
          targetUnitId: post.targetUnitId,
        }),
      );
    }
    return drafts;
  },
};

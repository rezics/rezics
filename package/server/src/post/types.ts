import type { PinKind } from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { publicUserSelect } from "@/utils/sanitizeUser";

/**
 * Prisma include for post relations.
 */
export const postInclude = {
  unit: {
    include: {
      user: { select: publicUserSelect },
      contentModerationState: true,
      inRealms: {
        where: { state: "VISIBLE" },
        select: { realmUnitId: true },
        take: 1,
      },
    },
  },
} satisfies Prisma.PostInclude;

/**
 * Internal post type with relations.
 *
 * Post has its own `content` field (fast path, no UnitTranslation),
 * but still links to Unit for user/reaction data.
 *
 * `pinKind`/`pinPosition` are the promotion overlay for the rendered thread
 * scope, attached by the thread read (`attachPinKinds`).
 */
export type PostWithRelations = Prisma.PostGetPayload<{
  include: typeof postInclude;
}> & {
  pinKind?: PinKind | null;
  pinPosition?: string | null;
};

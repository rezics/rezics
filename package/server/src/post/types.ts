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
      translations: true,
      contentTranslations: true,
      supportLanguages: true,
      inRealms: {
        where: { state: "APPROVED" },
        select: { realmUnitId: true },
        take: 1,
      },
    },
  },
} satisfies Prisma.PostInclude;

/**
 * Internal post type with relations.
 *
 * Root post title/body are resolved from UnitTranslation and ContentTranslation.
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

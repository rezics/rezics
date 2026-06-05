import type { PinKind } from "@rezics/contract";
import {
  type PublicUserSelected,
  publicUserSelect,
} from "@/utils/sanitizeUser";
import type {
  ContentTranslation,
  Post,
  Unit,
  UnitRealm,
  UnitSupportLanguage,
  UnitTranslation,
} from "../db/schema";

/** Legacy include shape retained for tests while post service migrates. */
export const postInclude = {
  unit: {
    include: {
      user: { select: publicUserSelect },
      translations: true,
      contentTranslations: true,
      supportLanguages: true,
      inRealms: {
        where: { moderationStatus: "APPROVED" },
        select: { realmUnitId: true },
        take: 1,
      },
    },
  },
} as const;

/**
 * Internal post type with relations.
 *
 * Root post title/body are resolved from UnitTranslation and ContentTranslation.
 *
 * `pinKind`/`pinPosition` are the promotion overlay for the rendered thread
 * scope, attached by the thread read (`attachPinKinds`).
 */
export type PostWithRelations = typeof Post.$inferSelect & {
  unit: typeof Unit.$inferSelect & {
    user?: PublicUserSelected | null;
    translations: Array<typeof UnitTranslation.$inferSelect>;
    contentTranslations: Array<typeof ContentTranslation.$inferSelect>;
    supportLanguages: Array<typeof UnitSupportLanguage.$inferSelect>;
    inRealms?: Array<Pick<typeof UnitRealm.$inferSelect, "realmUnitId">>;
  };
  pinKind?: PinKind | null;
  pinPosition?: string | null;
};

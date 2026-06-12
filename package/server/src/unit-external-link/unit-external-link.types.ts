import type {
  Entity,
  Unit,
  UnitExternalLink,
  UnitTranslation,
} from "../db/schema";

export type HydratedExternalLinkUnit = typeof Unit.$inferSelect & {
  translations: (typeof UnitTranslation.$inferSelect)[];
};

export type HydratedExternalLinkEntity = typeof Entity.$inferSelect & {
  unit: HydratedExternalLinkUnit;
};

export type UnitExternalLinkWithRelations =
  typeof UnitExternalLink.$inferSelect & {
    sourceEntity?: HydratedExternalLinkEntity | null;
    labelUnit?: HydratedExternalLinkUnit | null;
  };

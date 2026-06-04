import type {
  CreditAttribution,
  CreditAttributionEvidence,
  Entity,
  SourceSite,
  Unit,
  UnitExternalRef,
  UnitTranslation,
} from "../db/schema";

export const creditAttributionInclude = {
  entity: {
    include: {
      entity: true,
      translations: true,
    },
  },
  evidence: {
    include: {
      sourceRef: {
        include: {
          sourceSite: {
            include: {
              entity: {
                include: {
                  unit: {
                    include: {
                      translations: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ observedAt: "desc" }],
  },
} as const;

export type CreditAttributionWithRelations =
  typeof CreditAttribution.$inferSelect & {
    entity?:
      | (typeof Unit.$inferSelect & {
          entity?: typeof Entity.$inferSelect | null;
          translations?: Array<typeof UnitTranslation.$inferSelect>;
        })
      | null;
    evidence?: Array<
      typeof CreditAttributionEvidence.$inferSelect & {
        sourceRef?:
          | (typeof UnitExternalRef.$inferSelect & {
              sourceSite?:
                | (typeof SourceSite.$inferSelect & {
                    entity?:
                      | (typeof Entity.$inferSelect & {
                          unit?: typeof Unit.$inferSelect & {
                            translations?: Array<
                              typeof UnitTranslation.$inferSelect
                            >;
                          };
                        })
                      | null;
                  })
                | null;
            })
          | null;
      }
    >;
  };

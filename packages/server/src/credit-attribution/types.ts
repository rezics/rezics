import type {
  CreditAttribution,
  CreditAttributionEvidence,
  Entity,
  Unit,
  UnitExternalLink,
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
      sourceExternalLink: {
        include: {
          sourceEntity: {
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
        sourceExternalLink?:
          | (typeof UnitExternalLink.$inferSelect & {
              sourceEntity?:
                | (typeof Entity.$inferSelect & {
                    unit?: typeof Unit.$inferSelect & {
                      translations?: Array<typeof UnitTranslation.$inferSelect>;
                    };
                  })
                | null;
            })
          | null;
      }
    >;
  };

import type { ServerRelationsBuilder } from "./types";

export function attributionRelations(r: ServerRelationsBuilder) {
  return {
    CreditAttribution: {
      UnitExternalLinks: r.many.UnitExternalLink(),
    },
  };
}

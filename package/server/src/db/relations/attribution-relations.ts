import type { ServerRelationsBuilder } from "./types";

export function attributionRelations(r: ServerRelationsBuilder) {
  return {
    CreditAttribution: {
      UnitExternalRefs: r.many.UnitExternalRef(),
    },
  };
}

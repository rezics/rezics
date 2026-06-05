import type { ServerRelationsBuilder } from "./types";

export function sourceRelations(r: ServerRelationsBuilder) {
  return {
    SourceSite: {
      Entity: r.one.Entity({
        from: r.SourceSite.entityUnitId,
        to: r.Entity.unitId,
      }),
      Units: r.many.Unit({
        from: r.SourceSite.entityUnitId.through(
          r.UnitExternalRef.sourceSiteEntityUnitId,
        ),
        to: r.Unit.id.through(r.UnitExternalRef.unitId),
      }),
    },
    UnitExternalRef: {
      CreditAttributions: r.many.CreditAttribution({
        from: r.UnitExternalRef.id.through(
          r.CreditAttributionEvidence.sourceRefId,
        ),
        to: [
          r.CreditAttribution.unitId.through(
            r.CreditAttributionEvidence.unitId,
          ),
          r.CreditAttribution.entityId.through(
            r.CreditAttributionEvidence.entityId,
          ),
          r.CreditAttribution.role.through(r.CreditAttributionEvidence.role),
        ],
      }),
      GameSystemRequirements: r.many.GameSystemRequirement(),
    },
  };
}

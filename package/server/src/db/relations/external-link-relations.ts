import type { ServerRelationsBuilder } from "./types";

export function externalLinkRelations(r: ServerRelationsBuilder) {
  return {
    UnitExternalLink: {
      Unit: r.one.Unit({
        from: r.UnitExternalLink.unitId,
        to: r.Unit.id,
        alias: "UnitExternalLink_unitId_Unit_id",
      }),
      LabelUnit: r.one.Unit({
        from: r.UnitExternalLink.labelUnitId,
        to: r.Unit.id,
        alias: "UnitExternalLink_labelUnitId_Unit_id",
      }),
      SourceEntity: r.one.Entity({
        from: r.UnitExternalLink.sourceEntityUnitId,
        to: r.Entity.unitId,
        alias: "UnitExternalLink_sourceEntityUnitId_Entity_unitId",
      }),
      CreditAttributions: r.many.CreditAttribution({
        from: r.UnitExternalLink.id.through(
          r.CreditAttributionEvidence.sourceExternalLinkId,
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

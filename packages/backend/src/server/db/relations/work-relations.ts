import type { ServerRelationsBuilder } from "./types";

export function workRelations(r: ServerRelationsBuilder) {
  return {
    Book: {
      Unit: r.one.Unit({
        from: r.Book.unitId,
        to: r.Unit.id,
      }),
    },
    Entity: {
      Unit: r.one.Unit({
        from: r.Entity.unitId,
        to: r.Unit.id,
      }),
      SourceExternalLinks: r.many.UnitExternalLink({
        alias: "UnitExternalLink_sourceEntityUnitId_Entity_unitId",
      }),
    },
    Game: {
      Unit: r.one.Unit({
        from: r.Game.unitId,
        to: r.Unit.id,
      }),
      GameSystemRequirements: r.many.GameSystemRequirement(),
    },
    GameSystemRequirement: {
      Game: r.one.Game({
        from: r.GameSystemRequirement.gameUnitId,
        to: r.Game.unitId,
      }),
      Unit: r.one.Unit({
        from: r.GameSystemRequirement.platformEntityId,
        to: r.Unit.id,
      }),
      UnitExternalLink: r.one.UnitExternalLink({
        from: r.GameSystemRequirement.sourceExternalLinkId,
        to: r.UnitExternalLink.id,
      }),
    },
    Link: {
      Unit: r.one.Unit({
        from: r.Link.unitId,
        to: r.Unit.id,
      }),
    },
    Media: {
      Unit: r.one.Unit({
        from: r.Media.unitId,
        to: r.Unit.id,
      }),
    },
    Zone: {
      Unit: r.one.Unit({
        from: r.Zone.unitId,
        to: r.Unit.id,
      }),
    },
  };
}

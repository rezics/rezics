import type { ServerRelationsBuilder } from "./types";

export function aliasRelations(r: ServerRelationsBuilder) {
  return {
    UnitAlias: {
      User_createdById: r.one.User({
        from: r.UnitAlias.createdById,
        to: r.User.unitId,
        alias: "UnitAlias_createdById_User_unitId",
      }),
      Unit: r.one.Unit({
        from: r.UnitAlias.unitId,
        to: r.Unit.id,
      }),
      User_updatedById: r.one.User({
        from: r.UnitAlias.updatedById,
        to: r.User.unitId,
        alias: "UnitAlias_updatedById_User_unitId",
      }),
      Users: r.many.User({
        from: r.UnitAlias.id.through(r.UnitAliasVote.aliasId),
        to: r.User.unitId.through(r.UnitAliasVote.userId),
        alias: "UnitAlias_id_User_unitId_via_UnitAliasVote",
      }),
    },
  };
}

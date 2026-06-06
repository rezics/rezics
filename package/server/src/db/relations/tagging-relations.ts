import type { ServerRelationsBuilder } from "./types";

export function taggingRelations(r: ServerRelationsBuilder) {
  return {
    UserTagApplication: {
      Unit_tagUnitId: r.one.Unit({
        from: r.UserTagApplication.tagUnitId,
        to: r.Unit.id,
        alias: "UserTagApplication_tagUnitId_Unit_id",
      }),
      Unit_unitId: r.one.Unit({
        from: r.UserTagApplication.unitId,
        to: r.Unit.id,
        alias: "UserTagApplication_unitId_Unit_id",
      }),
      User: r.one.User({
        from: r.UserTagApplication.userId,
        to: r.User.unitId,
      }),
    },
  };
}

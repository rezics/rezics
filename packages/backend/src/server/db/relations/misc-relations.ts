import type { ServerRelationsBuilder } from "./types";

export function miscRelations(r: ServerRelationsBuilder) {
  return {
    HistoryOutbox: {
      User_actorUserId: r.one.User({
        from: r.HistoryOutbox.actorUserId,
        to: r.User.unitId,
        alias: "HistoryOutbox_actorUserId_User_unitId",
      }),
      User_processedById: r.one.User({
        from: r.HistoryOutbox.processedById,
        to: r.User.unitId,
        alias: "HistoryOutbox_processedById_User_unitId",
      }),
      Unit: r.one.Unit({
        from: r.HistoryOutbox.unitId,
        to: r.Unit.id,
      }),
    },
  };
}

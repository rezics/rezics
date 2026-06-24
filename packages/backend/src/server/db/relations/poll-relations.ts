import type { ServerRelationsBuilder } from "./types";

export function pollRelations(r: ServerRelationsBuilder) {
  return {
    Poll: {
      Unit: r.one.Unit({
        from: r.Poll.unitId,
        to: r.Unit.id,
        alias: "Poll_unitId_Unit_id",
      }),
      Units: r.many.Unit({
        from: r.Poll.unitId.through(r.PollOption.pollUnitId),
        to: r.Unit.id.through(r.PollOption.unitId),
        alias: "Poll_unitId_Unit_id_via_PollOption",
      }),
      PollOptions: r.many.PollOption({
        from: r.Poll.unitId.through(r.PollVote.pollUnitId),
        to: [
          r.PollOption.pollUnitId.through(r.PollVote.pollUnitId),
          r.PollOption.optionId.through(r.PollVote.optionId),
        ],
      }),
    },
    PollOption: {
      Polls: r.many.Poll(),
    },
  };
}

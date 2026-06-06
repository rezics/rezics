import type { ServerRelationsBuilder } from "./types";

export function scoreRelations(r: ServerRelationsBuilder) {
  return {
    ScoreEntry: {
      Units: r.many.Unit({
        from: r.ScoreEntry.id.through(r.Post.scoreEntryId),
        to: r.Unit.id.through(r.Post.unitId),
      }),
    },
  };
}

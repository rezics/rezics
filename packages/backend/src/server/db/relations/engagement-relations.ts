import type { ServerRelationsBuilder } from "./types";

export function engagementRelations(r: ServerRelationsBuilder) {
  return {
    Feedback: {
      ModerationCases: r.many.ModerationCase(),
    },
  };
}

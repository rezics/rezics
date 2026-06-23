import { ApiClient } from "@/lib/api-client";
import { Keys } from "./keys";

export const tagListQuery = (args: { offset?: number; limit?: number }) =>
  ApiClient.query("tags", "list", {
    query: args,
    reactivityKeys: [Keys.tags],
  });

export const tagForUnitQuery = (unitId: string) =>
  ApiClient.query("tags", "forUnit", {
    params: { unitId },
    reactivityKeys: [Keys.tags, Keys.unit(unitId)],
  });

export const voteTagAtom = ApiClient.mutation("tags", "vote");

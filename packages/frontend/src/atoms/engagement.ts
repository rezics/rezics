import { ApiClient } from "@/lib/api-client";
import { Keys } from "./keys";

export const subscriptionCheckQuery = (unitId: string) =>
  ApiClient.query("subscriptions", "check", {
    params: { subscribedUnitId: unitId },
    reactivityKeys: [Keys.unit(unitId)],
  });

export const subscribeAtom = ApiClient.mutation("subscriptions", "create");
export const unsubscribeAtom = ApiClient.mutation("subscriptions", "delete");

export const createReactionAtom = ApiClient.mutation("reactions", "create");
export const removeReactionAtom = ApiClient.mutation("reactions", "remove");

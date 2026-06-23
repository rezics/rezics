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

// Query: public reaction history for a user (given reactions)
// 查询：用户发出的反应历史（公开）
export const userReactionsGivenQuery = (userId: string, limit = 25) =>
  ApiClient.query("profile", "reactionGiven", {
    params: { userId },
    query: { limit },
    reactivityKeys: [Keys.user(userId)],
  });

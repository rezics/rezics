import { ApiClient } from "@/lib/api-client";
import { Keys } from "./keys";

export const mySubscriptionsQuery = () =>
  ApiClient.query("subscriptions", "listMine", {
    query: {},
    reactivityKeys: [Keys.shelves],
  });

import { ApiClient } from "@/lib/api-client";
import { Keys } from "./keys";

export const contentSearchQuery = (args: { q: string; offset?: number; limit?: number }) =>
  ApiClient.query("search", "searchContent", {
    payload: args,
    reactivityKeys: [Keys.search],
  });

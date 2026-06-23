import { ApiClient } from "@/lib/api-client";
import { Keys } from "./keys";

export const commentListQuery = (args: { offset?: number; limit?: number }) =>
  ApiClient.query("comments", "list", {
    query: args,
    reactivityKeys: [Keys.comments],
  });

export const createCommentAtom = ApiClient.mutation("comments", "create");
export const updateCommentAtom = ApiClient.mutation("comments", "update");
export const deleteCommentAtom = ApiClient.mutation("comments", "delete");

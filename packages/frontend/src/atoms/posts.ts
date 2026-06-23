import { ApiClient } from "@/lib/api-client";
import { Keys } from "./keys";

export const postQuery = (unitId: string) =>
  ApiClient.query("posts", "get", {
    params: { unitId },
    reactivityKeys: [Keys.post(unitId)],
  });

export const postListQuery = (args: { offset?: number; limit?: number }) =>
  ApiClient.query("posts", "list", {
    query: args,
    reactivityKeys: [Keys.posts],
  });

export const createPostAtom = ApiClient.mutation("posts", "create");
export const updatePostAtom = ApiClient.mutation("posts", "update");
export const deletePostAtom = ApiClient.mutation("posts", "delete");

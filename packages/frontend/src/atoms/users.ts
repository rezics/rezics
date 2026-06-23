import { ApiClient } from "@/lib/api-client";
import { Keys } from "./keys";

export const currentUserQuery = () =>
  ApiClient.query("users", "getMe", {
    reactivityKeys: [Keys.user("me")],
  });

export const userQuery = (userId: string) =>
  ApiClient.query("users", "getById", {
    params: { userId },
    reactivityKeys: [Keys.user(userId)],
  });

export const userBySlugQuery = (slug: string) =>
  ApiClient.query("users", "getBySlug", {
    params: { slug },
    reactivityKeys: [Keys.user(slug)],
  });

export const updateProfileAtom = ApiClient.mutation("users", "updateMe");

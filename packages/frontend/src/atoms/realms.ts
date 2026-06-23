import { ApiClient } from "@/lib/api-client";
import { Keys } from "./keys";

export const realmBySlugQuery = (slug: string) =>
  ApiClient.query("realms", "getBySlug", {
    params: { slug },
    reactivityKeys: [Keys.realm(slug)],
  });

export const realmQuery = (unitId: string) =>
  ApiClient.query("realms", "getById", {
    params: { unitId },
    reactivityKeys: [Keys.realm(unitId)],
  });

export const myRealmsQuery = () =>
  ApiClient.query("realms", "listMine", {
    reactivityKeys: [Keys.realms],
  });

export const realmListQuery = (args: { offset?: number; limit?: number }) =>
  ApiClient.query("realms", "list", {
    query: args,
    reactivityKeys: [Keys.realms],
  });

export const joinRealmAtom = ApiClient.mutation("realms", "addMember");

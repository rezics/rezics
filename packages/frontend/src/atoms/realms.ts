import { ApiClient } from "@/lib/api-client";
import { Keys } from "./keys";

export const PAGE_SIZE = 25;

// Query: paginated realm list
// 查询：分页 realm 列表
export const realmListQuery = (offset = 0) =>
  ApiClient.query("realms", "list", {
    query: { limit: PAGE_SIZE, offset },
    reactivityKeys: [Keys.realms],
  });

// Query: single realm by slug
// 查询：按 slug 获取单个 realm
export const realmBySlugQuery = (slug: string) =>
  ApiClient.query("realms", "getBySlug", {
    params: { slug },
    reactivityKeys: [Keys.realm(slug)],
  });

// Query: single realm by unitId
// 查询：按 unitId 获取单个 realm
export const realmQuery = (unitId: string) =>
  ApiClient.query("realms", "getById", {
    params: { unitId },
    reactivityKeys: [Keys.realm(unitId)],
  });

// Query: current user's realms
// 查询：当前用户的 realm 列表
export const myRealmsQuery = ApiClient.query("realms", "listMine", {
  reactivityKeys: [Keys.realms],
});

// Query: realms a specific user belongs to
// 查询：指定用户加入的 realm 列表
export const userRealmsQuery = (userId: string) =>
  ApiClient.query("realms", "listByMember", {
    params: { userId },
    reactivityKeys: [Keys.realms],
  });

// Query: current user's membership in a realm
// 查询：当前用户在某个 realm 的成员信息
export const realmMembershipQuery = (unitId: string) =>
  ApiClient.query("realms", "getMyMembership", {
    params: { unitId },
    reactivityKeys: [Keys.realmMembers(unitId)],
  });

// Mutation: join a realm (add self as member)
// 变更：加入 realm（将自己添加为成员）
export const joinRealmAtom = ApiClient.mutation("realms", "addMember");

// Mutation: leave a realm (remove self)
// 变更：离开 realm（移除自己）
export const leaveRealmAtom = ApiClient.mutation("realms", "removeMember");

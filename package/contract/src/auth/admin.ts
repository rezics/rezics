import { t } from "elysia";

import { authUserSchema } from "./sign-in";

export const listUsersResponseSchema = t.Object({
  users: t.Array(authUserSchema),
  total: t.Number(),
});
export type ListUsersResponse = (typeof listUsersResponseSchema)["static"];

export const removeUserBodySchema = t.Object({
  userId: t.String(),
});
export type RemoveUserBody = (typeof removeUserBodySchema)["static"];

export const banUserBodySchema = t.Object({
  userId: t.String(),
  reason: t.Optional(t.String()),
});
export type BanUserBody = (typeof banUserBodySchema)["static"];

export const unbanUserBodySchema = t.Object({
  userId: t.String(),
});
export type UnbanUserBody = (typeof unbanUserBodySchema)["static"];

export const setRoleBodySchema = t.Object({
  userId: t.String(),
  role: t.String(),
});
export type SetRoleBody = (typeof setRoleBodySchema)["static"];

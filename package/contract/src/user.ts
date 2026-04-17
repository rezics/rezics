import { t } from "elysia";
import { paginationLimitSchema } from "./pagination";

// ============================================================
// USER DTO (UserType removed — no AUTHOR/PRESS/PRODUCER)
// ============================================================

export const userDTOSchema = t.Object({
  unitId: t.String(),
  email: t.Optional(t.String()),
  slug: t.Optional(t.String()),
  name: t.String(),
  avatar: t.Optional(t.String()),
  bio: t.Optional(t.String()),
  description: t.Optional(t.String()),
  followersCount: t.Optional(t.Number()),
  followingsCount: t.Optional(t.Number()),
  joinDate: t.Optional(t.String()),
  permission: t.Optional(
    t.Object(
      {
        role: t.Array(t.String()),
      },
      { additionalProperties: true },
    ),
  ),
});

export type UserDTO = (typeof userDTOSchema)["static"];

export const userListQuerySchema = t.Object({
  q: t.Optional(t.String()),
  email: t.Optional(t.String()),
  slug: t.Optional(t.String()),
  page: t.Optional(t.Numeric()),
  limit: paginationLimitSchema,
});

export type UserListQuery = (typeof userListQuerySchema)["static"];

export const userParamsSchema = t.Object({
  unitId: t.String(),
});

export type UserParams = (typeof userParamsSchema)["static"];

export const createUserSchema = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
  slug: t.String({
    minLength: 5,
    pattern: "^[a-zA-Z0-9](?:[a-zA-Z0-9-_]*[a-zA-Z0-9])?$",
  }),
  avatar: t.Optional(t.String()),
  bio: t.Optional(t.String()),
  verificationCode: t.Optional(t.String()),
});

export type CreateUser = (typeof createUserSchema)["static"];

export const createUserFullSchema = t.Object({
  ...createUserSchema.properties,
});

export type CreateUserFull = (typeof createUserFullSchema)["static"];

export const updateUserSchema = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  avatar: t.Optional(t.String()),
  bio: t.Optional(t.String()),
  description: t.Optional(t.String()),
  password: t.Optional(t.String({ minLength: 6 })),
});

export type UpdateUser = (typeof updateUserSchema)["static"];

export const loginSchema = t.Object({
  email: t.String({ format: "email" }),
  password: t.String(),
});

export type LoginUser = (typeof loginSchema)["static"];

// ============================================================
// USER SETTINGS
// ============================================================

export const realmTagPreferenceSchema = t.Object({
  realmIds: t.Array(t.String(), { maxItems: 50 }),
  maxDisplay: t.Number(),
});

export const userSettingsSchema = t.Object({
  realmTagPreferences: t.Optional(
    t.Record(t.String(), realmTagPreferenceSchema),
  ),
  preferredLanguages: t.Optional(t.Array(t.String())),
});

export type UserSettings = (typeof userSettingsSchema)["static"];

export const updateUserSettingsSchema = t.Partial(userSettingsSchema);

export type UpdateUserSettings = (typeof updateUserSettingsSchema)["static"];

// ============================================================
// USER BRIEF (lightweight — card/mention contexts)
// ============================================================

export const userBriefSchema = t.Object({
  unitId: t.String(),
  name: t.String(),
  slug: t.Optional(t.String()),
  bio: t.Optional(t.String()),
  avatar: t.Optional(t.String()),
});

export type UserBrief = (typeof userBriefSchema)["static"];

export const userBriefBatchRequestSchema = t.Object({
  unitIds: t.Array(t.String(), { maxItems: 200 }),
});

export type UserBriefBatchRequest =
  (typeof userBriefBatchRequestSchema)["static"];

export const userBriefBatchResponseSchema = t.Object({
  users: t.Array(userBriefSchema),
});

export type UserBriefBatchResponse =
  (typeof userBriefBatchResponseSchema)["static"];

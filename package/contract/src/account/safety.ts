import { t } from "elysia";

// ============================================================
// DATA EXPORT & ACCOUNT DELETION
// ============================================================

/**
 * Self-service data export payload. Assembled on request and returned inline
 * as JSON (no async job / file storage). Scope: profile + settings + authored
 * content (posts/reviews/remarks, shelves) + social graph (follows, blocks).
 */
export const userDataExportSchema = t.Object({
  exportedAt: t.String(),
  profile: t.Object({
    unitId: t.String(),
    handle: t.Optional(t.Nullable(t.String())),
    name: t.Optional(t.Nullable(t.String())),
    email: t.Optional(t.Nullable(t.String())),
    bio: t.Optional(t.Nullable(t.String())),
    avatar: t.Optional(t.Nullable(t.String())),
    joinDate: t.Optional(t.Nullable(t.String())),
  }),
  settings: t.Unknown(),
  posts: t.Array(
    t.Object({
      unitId: t.String(),
      kind: t.String(),
      title: t.String(),
      createdAt: t.String(),
    }),
  ),
  shelves: t.Array(
    t.Object({
      unitId: t.String(),
      title: t.String(),
      updatedAt: t.String(),
    }),
  ),
  userUnitCollections: t.Array(
    t.Object({
      unitId: t.String(),
      searchText: t.Optional(t.Nullable(t.String())),
      createdAt: t.String(),
      updatedAt: t.String(),
    }),
  ),
  userTagApplications: t.Array(
    t.Object({
      unitId: t.String(),
      tagUnitId: t.String(),
      position: t.Optional(t.Nullable(t.String())),
      createdAt: t.String(),
      updatedAt: t.String(),
    }),
  ),
  follows: t.Array(
    t.Object({
      targetUnitId: t.String(),
      channels: t.Array(t.String()),
      createdAt: t.String(),
    }),
  ),
  blocks: t.Array(
    t.Object({
      blockedId: t.String(),
      createdAt: t.String(),
    }),
  ),
});

export type UserDataExport = (typeof userDataExportSchema)["static"];

/**
 * Account deletion confirmation. `confirmation` MUST equal the caller's
 * account handle (their `@`-handle / slug); the server rejects any mismatch.
 * This is the explicit confirmation the endpoint requires before it anonymizes
 * the account — there is no implicit/default deletion path.
 */
export const deleteAccountBodySchema = t.Object({
  confirmation: t.String({ minLength: 1 }),
});

export type DeleteAccountBody = (typeof deleteAccountBodySchema)["static"];

export const deleteAccountResultSchema = t.Object({
  deleted: t.Boolean(),
});

export type DeleteAccountResult = (typeof deleteAccountResultSchema)["static"];

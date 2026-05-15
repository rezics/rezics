import type { Static } from "elysia";
import { t } from "elysia";

// ANCHOR: User Search Document
// UserType removed — no more AUTHOR/PRESS/PRODUCER distinction.

export const UserSearchDocumentSchema = t.Object({
  id: t.String(),
  /** Canonical user identifier — the USER `Unit.id`. Equals `id` post-`user-namespace-slug`. */
  unitId: t.String(),
  name: t.String(),
  email: t.Optional(t.String()),
  slug: t.Optional(t.Union([t.String(), t.Null()])),
  avatar: t.Optional(t.Union([t.String(), t.Null()])),
  bio: t.Optional(t.Union([t.String(), t.Null()])),
  description: t.Optional(t.Union([t.String(), t.Null()])),
  followersCount: t.Optional(t.Union([t.Number(), t.Null()])),
  followingsCount: t.Optional(t.Union([t.Number(), t.Null()])),
  joinDate: t.Optional(t.Union([t.String(), t.Null()])),
  permission: t.Optional(
    t.Object(
      {
        role: t.Array(t.String()),
      },
      { additionalProperties: true },
    ),
  ),
});

export type UserSearchDocument = Static<typeof UserSearchDocumentSchema>;

export interface UserSearchResult {
  users: UserSearchDocument[];
  total: number;
  processingTimeMs: number;
  query: string;
}

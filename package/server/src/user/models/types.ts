// Type only used in server, otherwise use contract

import { t } from "elysia";
import type { Unit, User } from "../../db/schema";

/**
 * Internal user type with relations and the canonical slug attached
 * separately.
 *
 * The User row does not carry the slug column directly — slug now lives on
 * the USER `Unit`. Services that load Users attach `slug` as part of the
 * read path so DTO mappers can read it without re-querying.
 */
export type UserWithRelations = typeof User.$inferSelect & {
  units?: (typeof Unit.$inferSelect)[];
  /** Canonical slug copied from the matching USER `Unit.slug`. */
  slug?: string | null;
};

/**
 * Query filter types
 */
export type UserFilterOptions = {
  q?: string; // search in name or slug
  slug?: string;
  page?: number;
  limit?: number;
};

/** User relation hydration shape used by services that attach Unit rows. */
export const userInclude = {
  units: {
    take: 10,
    orderBy: { createdAt: "desc" },
  },
};

/**
 * JWT Payload type
 */
export const jwtPayloadSchema = t.Object({
  userId: t.String(),
  slug: t.Optional(t.String()),
  scope: t.Union([t.String(), t.Array(t.String())]),
  permission: t.Optional(
    t.Object(
      {
        role: t.Array(t.String()),
      },
      { additionalProperties: true },
    ),
  ),
});

export type JWTPayload = (typeof jwtPayloadSchema)["static"];

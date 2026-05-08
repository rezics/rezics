// Type only used in server, otherwise use contract

import { t } from "elysia";
import type { Prisma, Unit, User } from "#/prisma/client";

/**
 * Internal user type with relations
 */
export type UserWithRelations = User & {
  units?: Unit[];
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

/**
 * Prisma include for user relations
 */
export const userInclude = {
  units: {
    take: 10,
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.UserInclude;

/**
 * JWT Payload type
 */
export const jwtPayloadSchema = t.Object({
  userId: t.String(),
  slug: t.Optional(t.String()),
  scope: t.Union([t.String(), t.Array(t.String())]),
  /**
   * @deprecated use scope instead
   */
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

// Type only used in server, otherwise use contract

import type {User, Unit, Prisma} from '@/prisma/client';

/**
 * Internal user type with relations
 */
export type UserWithRelations = User & {
  Units?: Unit[];
};

/**
 * Query filter types
 */
export type UserFilterOptions = {
  q?: string; // search in name, email, or slug
  email?: string;
  slug?: string;
  type?: string;
  page?: number;
  limit?: number;
};

/**
 * Prisma include for user relations
 */
export const userInclude = {
  Units: {
    take: 10,
    orderBy: {createdAt: 'desc'},
  },
} satisfies Prisma.UserInclude;

/**
 * JWT Payload type
 */
export type JWTPayload = {
  userId: string;
  email: string;
  name: string;
};

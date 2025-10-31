import type {User} from '@/prisma/client';
import type {PublicUser, ReviewDTO} from '@package/contract';
import type {ReviewWithRelations} from './types';

/**
 * Sanitize user data for public response
 */
export function sanitizeUser(u: User): PublicUser {
  return {
    id: u.unitId,
    slug: u.slug,
    name: u.name,
    avatar: u.avatar ?? (null as any),
  };
}

export function mapReviewToDTO(unit: ReviewWithRelations): ReviewDTO {
  const meta = (unit.metadata ?? {}) as Record<string, unknown>;
  const rating =
    typeof meta.rating === 'number' ? (meta.rating as number) : undefined;
  return {
    id: unit.id,
    bookId: unit.targetUnitId ?? '',
    title: unit.title ?? undefined,
    content: unit.content ?? '',
    rating,
    created_at: unit.createdAt?.toISOString?.() ?? (unit.createdAt as any),
    user: unit.user ? sanitizeUser(unit.user) : undefined,
  };
}

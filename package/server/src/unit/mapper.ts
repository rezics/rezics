import type {User} from '@/prisma/client';
import type {PublicUser, UnitDTO} from '@package/contract';
import type {UnitWithRelations} from './types';

/**
 * Sanitize user data for public response
 */
export function sanitizeUser(u: User): PublicUser {
  return {
    unitId: u.unitId,
    slug: u.slug,
    name: u.name,
    avatar: u.avatar ?? (null as any),
  };
}

export function sanitizeUserWithBio(u: User): PublicUser {
  return {
    ...sanitizeUser(u),
    bio: u.bio ?? undefined,
  };
}

/**
 * Map internal Unit model to UnitDTO
 */
export function mapUnitToDTO(unit: UnitWithRelations): UnitDTO {
  return {
    id: unit.id,
    userId: unit.userId,
    user: sanitizeUser(unit.user),
    type: unit.type,
    status: unit.status,
    title: unit.title ?? undefined,
    content: unit.content ?? undefined,
    metadata: (unit.metadata as any) ?? undefined,
    targetUnitId: unit.targetUnitId ?? undefined,
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
    tags: unit.tags?.map(t => t.name) ?? [],
    reactionSummaries: unit.reactionSummaries,
  } as UnitDTO;
}

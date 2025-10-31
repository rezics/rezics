import type {User} from '@/prisma/client';
import type {PublicUser, ReadlistDTO} from '@package/contract';
import type {ReadlistWithRelations} from './types';

export function sanitizeUser(u: User): PublicUser {
  return {
    id: u.unitId,
    slug: u.slug,
    name: u.name,
    avatar: u.avatar ?? (null as any),
  };
}

export function mapBaseReadlistToDTO(u: ReadlistWithRelations): ReadlistDTO {
  const metadata = (u.metadata as any) ?? {};
  return {
    id: u.id,
    title: u.title ?? '',
    coverUrl: metadata?.coverUrl ?? undefined,
    creator: u.user ? sanitizeUser(u.user) : undefined,
    likes: u.reactions?.likeCount ?? 0,
    metadata: metadata,
  };
}

export function mapReadlistToDTO(u: ReadlistWithRelations): ReadlistDTO {
  // For now, same as base mapping; left for future expansion
  return mapBaseReadlistToDTO(u);
}

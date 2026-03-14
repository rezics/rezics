import type {User} from '@/prisma/client';
import type {UserDTO} from '@package/contract';
import type {UserWithRelations} from './types';

/**
 * Map internal User model to UserDTO (public data)
 */
export function mapUserToDTO(user: User | UserWithRelations): UserDTO {
  return {
    unitId: user.unitId,
    slug: user.slug,
    type: user.type,
    name: user.name,
    avatar: user.avatar || undefined,
    bio: user.bio || undefined,
    description: user.description || undefined,
    followersCount: user.followersCount,
    followingsCount: user.followingsCount,
    permission: user.permission as {role: string[]} | undefined,
    joinDate: user.joinDate?.toISOString(),
  };
}

/**
 * Map User to public profile
 */
export function mapUserToPublicProfile(
  user: User | UserWithRelations,
): UserDTO {
  return {
    unitId: user.unitId,
    slug: user.slug,
    name: user.name,
    avatar: user.avatar || undefined,
    bio: user.bio || undefined,
    description: user.description || undefined,
    followersCount: user.followersCount,
    followingsCount: user.followingsCount,
    joinDate: user.joinDate?.toISOString(),
  };
}

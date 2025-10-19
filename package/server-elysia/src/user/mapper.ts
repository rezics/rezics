import type {User} from '@/prisma/client';
import type {UserDTO} from '@package/contract';
import type {UserWithRelations} from './types';

/**
 * Map internal User model to UserDTO (public data)
 */
export function mapUserToDTO(user: User | UserWithRelations): UserDTO {
  return {
    id: user.unitId,
    email: user.email,
    slug: user.slug,
    name: user.name,
    avatar: user.avatar || undefined,
    bio: user.bio || undefined,
    joinDate: user.joinDate?.toISOString(),
  };
}

/**
 * Map User to public profile (without sensitive data like email)
 */
export function mapUserToPublicProfile(
  user: User | UserWithRelations,
): Omit<UserDTO, 'email'> {
  return {
    id: user.unitId,
    slug: user.slug,
    name: user.name,
    avatar: user.avatar || undefined,
    bio: user.bio || undefined,
    joinDate: user.joinDate?.toISOString(),
  };
}

import {prisma} from '@/prisma/client';
import {userIndex} from '@package/search/src/meili_index';
import type {UserSearchDocument} from './index';

/**
 * Sync a single user (by its unitId) into the Meilisearch `users` index.
 */
export async function syncUserToMeili(unitId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: {unitId},
  });

  if (!user) return;

  const doc: UserSearchDocument = {
    id: user.unitId,
    unitId: user.unitId,
    name: user.name,
    email: user.email,
    slug: user.slug,
    type: user.type,
    avatar: user.avatar,
    bio: user.bio,
    description: user.description,
    followersCount: user.followersCount,
    followingsCount: user.followingsCount,
    joinDate: user.joinDate,
    permission: (user.permission ?? null) as any,
  };

  await userIndex.addDocuments([doc]);
}

/**
 * Remove a single user (by its unitId) from the Meilisearch `users` index.
 */
export async function deleteUserFromMeili(unitId: string): Promise<void> {
  await userIndex.deleteDocuments([unitId]);
}

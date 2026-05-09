import { patchUserFields } from "@rezics/search";
import { prisma } from "#/prisma/client";
import { searchClient } from "../search-client";
import type { UserSearchDocument } from "./index";

/**
 * Sync a single user (by its userId) into the Meilisearch `users` index.
 */
export async function syncUserToMeili(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { userId },
  });

  if (!user) return;
  if (!user.slug || !user.name) {
    return;
  }

  const doc: UserSearchDocument = {
    id: user.userId,
    userId: user.userId,
    name: user.name,
    slug: user.slug,
    avatar: user.avatar,
    bio: user.bio,
    description: user.description,
    followersCount: user.followersCount,
    followingsCount: user.followingsCount,
    joinDate: user.joinDate ? user.joinDate.toISOString() : null,
    permission: (user.permission ?? null) as any,
  };

  await searchClient.userIndex.addDocuments([doc]);
}

/**
 * Remove a single user (by its userId) from the Meilisearch `users` index.
 */
export async function deleteUserFromMeili(userId: string): Promise<void> {
  await searchClient.userIndex.deleteDocuments([userId]);
}

export async function patchUserFieldsToMeili(
  userId: string,
  fields: Record<string, any>,
): Promise<void> {
  await patchUserFields(searchClient, userId, fields);
}

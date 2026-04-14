import { patchUserFields } from "@rezics/search";
import { prisma } from "#/prisma/client";
import { searchClient } from "../search-client";
import type { UserSearchDocument } from "./index";

/**
 * Sync a single user (by its unitId) into the Meilisearch `users` index.
 */
export async function syncUserToMeili(unitId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { unitId },
  });

  if (!user) return;

  const doc: UserSearchDocument = {
    id: user.unitId,
    unitId: user.unitId,
    name: user.name,
    slug: user.slug,
    avatar: user.avatar,
    bio: user.bio,
    description: user.description,
    followersCount: user.followersCount,
    followingsCount: user.followingsCount,
    joinDate: user.joinDate,
    permission: (user.permission ?? null) as any,
  };

  await searchClient.userIndex.addDocuments([doc]);
}

/**
 * Remove a single user (by its unitId) from the Meilisearch `users` index.
 */
export async function deleteUserFromMeili(unitId: string): Promise<void> {
  await searchClient.userIndex.deleteDocuments([unitId]);
}

export async function patchUserFieldsToMeili(
  unitId: string,
  fields: Record<string, any>,
): Promise<void> {
  await patchUserFields(searchClient, unitId, fields);
}

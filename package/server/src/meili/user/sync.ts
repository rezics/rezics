import { mainMarkdownSource } from "@rezics/contract";
import { patchUserFields } from "@rezics/search";
import { prisma } from "#/prisma/client";
import { requireSlugScopeId } from "@/infra/slug-scopes";
import { searchClient } from "../search-client";
import type { UserSearchDocument } from "./index";

async function fetchCanonicalSlug(userId: string): Promise<string | null> {
  const userScope = requireSlugScopeId("user");
  const unit = await prisma.unit.findUnique({
    where: { id: userId },
    select: { slug: true, slugScope: true, type: true },
  });
  if (!unit || unit.type !== "USER" || unit.slugScope !== userScope) {
    return null;
  }
  return unit.slug;
}

/**
 * Sync a single user (by unitId) into the Meilisearch `users` index.
 */
export async function syncUserToMeili(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { unitId: userId },
  });

  if (!user) return;
  if (!user.name) {
    return;
  }
  const slug = await fetchCanonicalSlug(userId);
  if (!slug) return;

  const doc: UserSearchDocument = {
    id: user.unitId,
    unitId: user.unitId,
    name: user.name,
    slug,
    avatar: user.avatar,
    bio: user.bio,
    description: user.description as UserSearchDocument["description"],
    descriptionText: mainMarkdownSource(user.description),
    followersCount: user.followersCount,
    followingsCount: user.followingsCount,
    joinDate: user.joinDate ? user.joinDate.toISOString() : null,
    permission: (user.permission ?? null) as any,
  };

  await searchClient.userIndex.addDocuments([doc]);
}

/**
 * Remove a single user (by unitId) from the Meilisearch `users` index.
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

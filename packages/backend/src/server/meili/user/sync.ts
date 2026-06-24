import { mainMarkdownSource } from "@rezics/contract";
import { patchUserFields } from "@rezics/search";
import { eq } from "drizzle-orm";
import { Unit, User } from "../../db/schema";
import { requireSlugScopeId } from "../../infra/slug-scopes";
import { searchClient } from "../search-client";
import type { UserSearchDocument } from "./index";

async function getServerDb() {
  const { db } = await import("../../db/client");
  return db;
}

async function fetchCanonicalSlug(userId: string): Promise<string | null> {
  const userScope = requireSlugScopeId("user");
  const db = await getServerDb();
  const [unit] = await db
    .select({ slug: Unit.slug, slugScope: Unit.slugScope, type: Unit.type })
    .from(Unit)
    .where(eq(Unit.id, userId))
    .limit(1);
  if (!unit || unit.type !== "USER" || unit.slugScope !== userScope) {
    return null;
  }
  return unit.slug;
}

/**
 * Sync a single user (by unitId) into the Meilisearch `users` index.
 */
export async function syncUserToMeili(userId: string): Promise<void> {
  const db = await getServerDb();
  const [user] = await db
    .select()
    .from(User)
    .where(eq(User.unitId, userId))
    .limit(1);

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
    summary: user.summary,
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

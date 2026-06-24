import {
  patchPostFields,
  patchPostsAuthor,
  patchPostsTarget,
  syncAllPosts,
  syncPostsByAuthor,
  syncPostsByTarget,
  syncSinglePost,
} from "../../../search/sync";
import { searchClient } from "../search-client";

export async function syncPostToMeili(unitId: string): Promise<void> {
  await syncSinglePost(searchClient, unitId);
}

export async function deletePostFromMeili(unitId: string): Promise<void> {
  await searchClient.deletePosts([unitId]);
}

export async function syncAllPostsToMeili() {
  return syncAllPosts(searchClient);
}

export async function syncPostsByAuthorToMeili(userId: string) {
  return syncPostsByAuthor(searchClient, userId);
}

export async function syncPostsByTargetToMeili(targetUnitId: string) {
  return syncPostsByTarget(searchClient, targetUnitId);
}

export async function patchPostsAuthorToMeili(
  userId: string,
  fields: Record<string, any>,
): Promise<void> {
  await patchPostsAuthor(searchClient, userId, fields);
}

export async function patchPostsTargetToMeili(
  targetUnitId: string,
): Promise<void> {
  await patchPostsTarget(searchClient, targetUnitId);
}

export async function patchPostFieldsToMeili(
  unitId: string,
  fields: Record<string, any>,
): Promise<void> {
  await patchPostFields(searchClient, unitId, fields);
}

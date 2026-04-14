import {
  syncSinglePost,
  syncAllPosts,
  syncPostsByAuthor,
  syncPostsByTarget,
} from "@rezics/search";
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

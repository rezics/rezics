import {
  buildFeedbackSearchDocument,
  patchFeedbackResolution,
} from "@rezics/search";
import { prisma } from "#/prisma/client";
import { searchClient } from "../search-client";

/**
 * Sync a single feedback (by its id) into the Meilisearch `feedbacks` index.
 */
export async function syncFeedbackToMeili(id: string): Promise<void> {
  const feedback = await prisma.feedback.findUnique({
    where: { id },
  });

  if (!feedback) return;

  await searchClient.feedbackIndex.addDocuments([
    buildFeedbackSearchDocument(feedback),
  ]);
}

/**
 * Remove a single feedback (by its id) from the Meilisearch `feedbacks` index.
 */
export async function deleteFeedbackFromMeili(id: string): Promise<void> {
  await searchClient.feedbackIndex.deleteDocuments([id]);
}

export async function patchFeedbackResolutionToMeili(
  id: string,
  fields: Record<string, any>,
): Promise<void> {
  await patchFeedbackResolution(searchClient, id, fields);
}

import {
  buildFeedbackSearchDocument,
  patchFeedbackResolution,
} from "@rezics/search";
import { eq } from "drizzle-orm";
import { Feedback } from "../../db/schema";
import { searchClient } from "../search-client";

async function getServerDb() {
  const { db } = await import("../../db/client");
  return db;
}

/**
 * Sync a single feedback (by its id) into the Meilisearch `feedbacks` index.
 */
export async function syncFeedbackToMeili(id: string): Promise<void> {
  const db = await getServerDb();
  const [feedback] = await db
    .select()
    .from(Feedback)
    .where(eq(Feedback.id, id))
    .limit(1);

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

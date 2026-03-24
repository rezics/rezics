import {prisma} from '#/prisma/client';
import {feedbackIndex} from '@package/search';
import type {FeedbackSearchDocument} from '@package/contract';

/**
 * Sync a single feedback (by its id) into the Meilisearch `feedbacks` index.
 */
export async function syncFeedbackToMeili(id: string): Promise<void> {
  const feedback = await prisma.feedback.findUnique({
    where: {id},
  });

  if (!feedback) return;

  const doc: FeedbackSearchDocument = {
    id: feedback.id,
    userId: feedback.userId,
    unitId: feedback.unitId,
    url: feedback.url,
    content: feedback.content,
    type: feedback.type,
    resolved: feedback.resolved,
    resolvedAt: feedback.resolvedAt?.toISOString() ?? null,
    createdAt: feedback.createdAt,
    updatedAt: feedback.updatedAt,
  };

  await feedbackIndex.addDocuments([doc]);
}

/**
 * Remove a single feedback (by its id) from the Meilisearch `feedbacks` index.
 */
export async function deleteFeedbackFromMeili(id: string): Promise<void> {
  await feedbackIndex.deleteDocuments([id]);
}

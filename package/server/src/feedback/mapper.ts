import type { FeedbackDTO } from "@rezics/contract";
import type { Feedback } from "../db/schema";

function lower<T extends string>(value: string | null | undefined): T | null {
  return value ? (value.toLowerCase() as T) : null;
}

export function mapFeedbackToDTO(
  model: typeof Feedback.$inferSelect,
): FeedbackDTO {
  return {
    id: model.id,
    userId: model.userId,
    targetKind: lower(model.targetKind),
    targetId: model.targetId,
    addressedUnitId: model.addressedUnitId,
    url: model.url,
    content: model.content,
    type: model.type as any,
    resolved: model.resolved,
    resolvedAt: model.resolvedAt
      ? (model.resolvedAt.toISOString?.() ?? (model.resolvedAt as any))
      : null,
    createdAt: model.createdAt.toISOString?.() ?? (model.createdAt as any),
    updatedAt: model.updatedAt.toISOString?.() ?? (model.updatedAt as any),
  };
}

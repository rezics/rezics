export const adminWorkMergeKeys = {
  all: () => ["adminWorkMerge"] as const,
  preview: (sourceWorkUnitId: string, targetWorkUnitId: string) =>
    [
      ...adminWorkMergeKeys.all(),
      "preview",
      sourceWorkUnitId,
      targetWorkUnitId,
    ] as const,
  details: () => [...adminWorkMergeKeys.all(), "detail"] as const,
  detail: (operationId: string) =>
    [...adminWorkMergeKeys.details(), operationId] as const,
} as const;

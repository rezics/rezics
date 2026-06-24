export const linkKeys = {
  all: () => ["links"] as const,
  lists: () => [...linkKeys.all(), "list"] as const,
  list: (filters?: Record<string, unknown>) =>
    [...linkKeys.lists(), filters] as const,
  details: () => [...linkKeys.all(), "detail"] as const,
  detail: (unitId: string) => [...linkKeys.details(), unitId] as const,
} as const;

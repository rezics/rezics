export const authJwtServiceKeys = {
  all: () => ['authJwtServices'] as const,
  lists: () => [...authJwtServiceKeys.all(), 'list'] as const,
  list: () => [...authJwtServiceKeys.lists()] as const,
  details: () => [...authJwtServiceKeys.all(), 'detail'] as const,
  detail: (serviceKey: string) =>
    [...authJwtServiceKeys.details(), serviceKey] as const,
} as const;

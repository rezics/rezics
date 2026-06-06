export const jwtServiceKeys = {
  all: () => ["jwtServices"] as const,
  lists: () => [...jwtServiceKeys.all(), "list"] as const,
  list: () => [...jwtServiceKeys.lists()] as const,
  details: () => [...jwtServiceKeys.all(), "detail"] as const,
  detail: (serviceKey: string) =>
    [...jwtServiceKeys.details(), serviceKey] as const,
} as const;

export const statusKeys = {
  all: ["status"] as const,
  meili: () => [...statusKeys.all, "meili"] as const,
  system: () => [...statusKeys.all, "system"] as const,
};

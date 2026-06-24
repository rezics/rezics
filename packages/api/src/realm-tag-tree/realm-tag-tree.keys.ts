export const realmTagTreeKeys = {
  all: ["realm-tag-tree"] as const,
  detail: (realmId: string) => [...realmTagTreeKeys.all, realmId] as const,
};

export const realmDockKeys = {
  root: ["realm-dock"] as const,
  detail: (realmId: string) =>
    [...realmDockKeys.root, "detail", realmId] as const,
};

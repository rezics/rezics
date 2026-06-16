export const realmSidebarKeys = {
  root: ["realm-sidebar"] as const,
  detail: (realmId: string) =>
    [...realmSidebarKeys.root, "detail", realmId] as const,
};

export const BASE_PROFILE_TAB_PATHS = [
  "",
  "/content",
  "/shelves",
  "/followers",
  "/reactions",
  "/activity",
] as const;

export const CURRENT_USER_PROFILE_TAB_PATHS = [
  ...BASE_PROFILE_TAB_PATHS,
  "/progress",
] as const;

export function profileTabPaths(isCurrentUser: boolean): string[] {
  return [
    ...(isCurrentUser
      ? CURRENT_USER_PROFILE_TAB_PATHS
      : BASE_PROFILE_TAB_PATHS),
  ];
}

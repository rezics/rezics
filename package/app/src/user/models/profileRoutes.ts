type UserProfileRouteInput = {
  unitId: string;
  slug?: string | null;
};

export function userSpaceHref(user: UserProfileRouteInput): string {
  return user.slug ? `/u/${user.slug}` : `/user/${user.unitId}`;
}

export function userProfileHref(user: UserProfileRouteInput): string {
  return `${userSpaceHref(user)}/profile`;
}

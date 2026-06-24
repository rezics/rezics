export function realmContextPostHref(input: {
  realmId: string;
  postUnitId: string;
}): string {
  return `/realm/${input.realmId}/post/${input.postUnitId}`;
}

export function realmContextPostEditHref(input: {
  realmId: string;
  postUnitId: string;
}): string {
  return `${realmContextPostHref(input)}/edit`;
}

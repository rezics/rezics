export function shouldRecordShareIntent(input: {
  actorUserId?: string | null;
  targetId?: string | null;
  isPending: boolean;
}): boolean {
  return Boolean(input.actorUserId && input.targetId && !input.isPending);
}

/**
 * Flat registry of notification event kinds. Keyed by dot-namespaced kind
 * string. Each entry declares whether the kind aggregates by (recipientId,
 * kind, sourceUnitId) at query time, and the broad category for UI grouping.
 *
 * The server-side `notifyBoundary.broadcast` validates `kind` against this
 * registry before emitting. The notify service also re-validates on the
 * `POST /internal/event` boundary as defense in depth.
 *
 * Engagement-subscription extends this registry with subscription-driven
 * kinds (`chapter.new`, `chapter.updated`, `review.new`, `member.joined`,
 * etc.). Add one-line entries here; consumers (server, notify, frontend)
 * pick up new kinds automatically.
 */
export const KIND_REGISTRY = {
  "reaction.like": { aggregatable: true, category: "reaction" },
  "reaction.favorite": { aggregatable: true, category: "reaction" },
  "follow.new": { aggregatable: true, category: "follow" },
  "comment.new": { aggregatable: false, category: "comment" },
  "mention.new": { aggregatable: false, category: "mention" },
  "system.notice": { aggregatable: false, category: "system" },
  "invitation.new": { aggregatable: false, category: "invitation" },
} as const satisfies Record<
  string,
  { aggregatable: boolean; category: string }
>;

export type NotificationKind = keyof typeof KIND_REGISTRY;

export function isValidKind(kind: string): kind is NotificationKind {
  return Object.prototype.hasOwnProperty.call(KIND_REGISTRY, kind);
}

export function isAggregatable(kind: string): boolean {
  return (
    isValidKind(kind) &&
    KIND_REGISTRY[kind as NotificationKind].aggregatable === true
  );
}

export function kindCategory(kind: string): string | undefined {
  if (!isValidKind(kind)) return undefined;
  return KIND_REGISTRY[kind as NotificationKind].category;
}

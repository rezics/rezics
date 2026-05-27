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
  // engagement-subscription: subscription-driven broadcast kinds.
  // Categories mirror the dot-prefix used in `CHANNEL_REGISTRY` so the
  // `<category>.*` wildcard tier in the fan-out resolver lines up with
  // the UI grouping. Aggregatability: `*.new` for distinct content is
  // false (each item is its own row); `*.updated` / `*.changed` collapse
  // to one summary per source; `*.deleted` is rare and informational.
  "chapter.new": { aggregatable: false, category: "chapter" },
  "chapter.updated": { aggregatable: true, category: "chapter" },
  "chapter.deleted": { aggregatable: false, category: "chapter" },
  "review.new": { aggregatable: false, category: "review" },
  "review.updated": { aggregatable: true, category: "review" },
  "edition.new": { aggregatable: false, category: "edition" },
  "metadata.changed": { aggregatable: true, category: "metadata" },
  "cover.changed": { aggregatable: true, category: "metadata" },
  "post.new": { aggregatable: false, category: "post" },
  "post.review": { aggregatable: false, category: "post" },
  "announcement.new": { aggregatable: false, category: "announcement" },
  "member.joined": { aggregatable: true, category: "member" },
  "unit.tagged": { aggregatable: true, category: "unit" },
  "item.added": { aggregatable: true, category: "item" },
  "item.removed": { aggregatable: true, category: "item" },
  "moderation.report.updated": {
    aggregatable: false,
    category: "moderation",
  },
  "moderation.subject.warning": {
    aggregatable: false,
    category: "moderation",
  },
  "moderation.case.assigned": {
    aggregatable: false,
    category: "moderation",
  },
  "moderation.appeal.updated": {
    aggregatable: false,
    category: "moderation",
  },
  "moderation.escalation.updated": {
    aggregatable: false,
    category: "moderation",
  },
} as const satisfies Record<
  string,
  { aggregatable: boolean; category: string }
>;

export type NotificationKind = keyof typeof KIND_REGISTRY;

export function isValidKind(kind: string): kind is NotificationKind {
  return Object.hasOwn(KIND_REGISTRY, kind);
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

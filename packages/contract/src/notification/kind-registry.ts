import type { NotificationPreferenceKey } from "../user/user";

/**
 * Flat registry of notification event kinds. Keyed by dot-namespaced kind
 * string. Each entry declares whether the kind aggregates by (recipientId,
 * kind, sourceUnitId) at query time, and the broad category for UI grouping.
 * 通知事件类型的扁平注册表。以点分命名空间的类型字符串为键。每个条目声明该类型
 * 是否在查询时按 (recipientId, kind, sourceUnitId) 聚合，以及用于 UI 分组的大类。
 *
 * The server-side `notifyBoundary.broadcast` validates `kind` against this
 * registry before emitting. The notify service also re-validates on the
 * `POST /internal/event` boundary as defense in depth.
 * 服务端的 `notifyBoundary.broadcast` 在发出前会对照此注册表校验 `kind`。notify
 * 服务还会在 `POST /internal/event` 边界上再次校验，作为纵深防御。
 *
 * Engagement-subscription extends this registry with subscription-driven
 * kinds (`chapter.new`, `chapter.updated`, `review.new`, `member.joined`,
 * etc.). Add one-line entries here; consumers (server, notify, frontend)
 * pick up new kinds automatically.
 * Engagement-subscription 用订阅驱动的类型（`chapter.new`、`chapter.updated`、
 * `review.new`、`member.joined` 等）扩展此注册表。在此处添加单行条目；消费者
 * （server、notify、frontend）会自动识别新类型。
 */
export const KIND_REGISTRY = {
  "reaction.upvote": { aggregatable: true, category: "reaction" },
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
  // engagement-subscription：订阅驱动的广播类型。category 与 `CHANNEL_REGISTRY`
  // 中使用的点前缀一致，使扇出解析器中的 `<category>.*` 通配层级与 UI 分组对齐。
  // 聚合性：对不同内容的 `*.new` 为 false（每项各占一行）；`*.updated` /
  // `*.changed` 按来源折叠为一条摘要；`*.deleted` 罕见且仅作告知用途。
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
  "feed.new": { aggregatable: false, category: "feed" },
  "section.updated": { aggregatable: true, category: "section" },
  "theme.updated": { aggregatable: true, category: "theme" },
  "member.joined": { aggregatable: true, category: "member" },
  "realm.rules.updated": { aggregatable: true, category: "realm" },
  "realm.join.requested": { aggregatable: false, category: "realm" },
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

/**
 * Maps a notification kind's category to the user-facing per-kind preference
 * toggle that gates it (see `NOTIFICATION_PREFERENCE_KEYS` in `../user`).
 * Categories with no entry are always delivered (ungated by user preference).
 * 将通知类型的 category 映射到门控它的面向用户的逐类型偏好开关（参见 `../user`
 * 中的 `NOTIFICATION_PREFERENCE_KEYS`）。没有条目的 category 始终投递（不受用户偏好门控）。
 */
const CATEGORY_TO_PREFERENCE_KEY: Record<string, NotificationPreferenceKey> = {
  comment: "reply",
  mention: "reply",
  review: "reply",
  follow: "follow",
  moderation: "moderation",
  realm: "realm",
  system: "system",
};

/**
 * The notification-preference toggle that gates the given kind, or `undefined`
 * when the kind is ungated (always delivered). Used by the dispatch pipeline
 * to suppress delivery for recipients who disabled the toggle.
 * 门控给定类型的通知偏好开关，若该类型不受门控（始终投递）则为 `undefined`。
 * 由分发流水线用于对关闭了该开关的收件人抑制投递。
 */
export function notificationPreferenceKeyForKind(
  kind: string,
): NotificationPreferenceKey | undefined {
  const category = kindCategory(kind);
  if (!category) return undefined;
  return CATEGORY_TO_PREFERENCE_KEY[category];
}

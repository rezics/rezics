/**
 * Per-UnitType registry of subscription channels.
 *
 * `categories` are the prefixes consumers can wildcard-match with
 * `<category>.*`. `events` are the exact event names accepted in
 * `Subscription.channels`. Both layers (backend write-validation and
 * frontend channel-picker UI) consume this same source of truth.
 *
 * Adding a channel for an existing UnitType is a one-line registry
 * extension — no migration. Adding a UnitType requires a registry entry
 * AND a corresponding `KIND_REGISTRY` entry per event.
 */
export const CHANNEL_REGISTRY = {
  BOOK: {
    categories: ["chapter", "review", "edition", "metadata"] as const,
    events: [
      "chapter.new",
      "chapter.updated",
      "chapter.deleted",
      "review.new",
      "review.updated",
      "edition.new",
      "metadata.changed",
      "cover.changed",
    ] as const,
  },
  USER: {
    categories: ["post", "review", "dm"] as const,
    events: ["post.new", "review.new", "dm.message"] as const,
  },
  REALM: {
    categories: ["post", "announcement", "member"] as const,
    events: ["post.new", "announcement.new", "member.joined"] as const,
  },
  ZONE: {
    categories: ["feed", "section", "announcement", "theme"] as const,
    events: [
      "feed.new",
      "section.updated",
      "announcement.new",
      "theme.updated",
    ] as const,
  },
  TAG: {
    categories: ["unit"] as const,
    events: ["unit.tagged"] as const,
  },
  SHELF: {
    categories: ["item"] as const,
    events: ["item.added", "item.removed"] as const,
  },
} as const;

export type SubscribableUnitType = keyof typeof CHANNEL_REGISTRY;

const SUBSCRIBABLE_TYPES = Object.keys(
  CHANNEL_REGISTRY,
) as SubscribableUnitType[];

export function isSubscribableUnitType(
  targetType: string,
): targetType is SubscribableUnitType {
  return SUBSCRIBABLE_TYPES.includes(targetType as SubscribableUnitType);
}

/**
 * Accept exactly one of three forms:
 *   - '*'                        global wildcard
 *   - '<category>.*'             category wildcard (category must be registered)
 *   - '<category>.<event>'       exact event (full string must be registered)
 */
export function isValidChannel(
  targetType: SubscribableUnitType,
  channel: string,
): boolean {
  if (channel === "*") return true;
  const entry = CHANNEL_REGISTRY[targetType];
  if (channel.endsWith(".*")) {
    const category = channel.slice(0, -2);
    return (entry.categories as readonly string[]).includes(category);
  }
  return (entry.events as readonly string[]).includes(channel);
}

export class InvalidChannelError extends Error {
  constructor(
    public readonly targetType: SubscribableUnitType,
    public readonly channel: string,
  ) {
    super(
      `Invalid channel '${channel}' for target type ${targetType}. Allowed: '*', '<category>.*' for categories [${CHANNEL_REGISTRY[targetType].categories.join(", ")}], or one of [${CHANNEL_REGISTRY[targetType].events.join(", ")}].`,
    );
    this.name = "InvalidChannelError";
  }
}

/**
 * Throws `InvalidChannelError` on the first offending channel. Empty
 * arrays pass (a subscription row with no channels is a stub but is not
 * shape-invalid — the service layer decides whether to reject empties).
 */
export function assertValidChannels(
  targetType: SubscribableUnitType,
  channels: readonly string[],
): void {
  for (const channel of channels) {
    if (!isValidChannel(targetType, channel)) {
      throw new InvalidChannelError(targetType, channel);
    }
  }
}

/**
 * `categoryOf('chapter.new') === 'chapter'`. Returns `undefined` if the
 * channel is `'*'` or contains no dot — the fan-out resolver uses this
 * to build the three-tier match query.
 */
export function categoryOf(kind: string): string | undefined {
  if (kind === "*") return undefined;
  const idx = kind.indexOf(".");
  if (idx <= 0) return undefined;
  return kind.slice(0, idx);
}

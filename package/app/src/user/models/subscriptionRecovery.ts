import type { UserSubscriptionListEntryDTO } from "@rezics/contract";

const OFFICIAL_RECOVERY_TARGETS = new Set([
  "REALM:rezics",
  "ZONE:book",
  "ZONE:realms",
  "ZONE:popular",
]);

const SLUG_TARGET_PREFIX = {
  USER: { short: "u", long: "user" },
  REALM: { short: "r", long: "realm" },
  TAG: { short: "t", long: "tag" },
  ZONE: { short: "z", long: "zone" },
  ENTITY: { short: "e", long: "entity" },
} as const;

export type RecoveryEntryGroup = {
  official: UserSubscriptionListEntryDTO[];
  other: UserSubscriptionListEntryDTO[];
};

export function isOfficialRecoveryEntry(entry: UserSubscriptionListEntryDTO) {
  if (!entry.subscribedSlug) return false;
  return OFFICIAL_RECOVERY_TARGETS.has(
    `${entry.subscribedType}:${entry.subscribedSlug}`,
  );
}

export function groupRecoveryEntries(
  entries: UserSubscriptionListEntryDTO[],
): RecoveryEntryGroup {
  const removed = entries
    .filter((entry) => entry.state === "REMOVED")
    .slice()
    .sort((a, b) => {
      const byType = a.subscribedType.localeCompare(b.subscribedType);
      if (byType !== 0) return byType;
      const aTitle =
        a.subscribedTitle ?? a.subscribedSlug ?? a.subscribedUnitId;
      const bTitle =
        b.subscribedTitle ?? b.subscribedSlug ?? b.subscribedUnitId;
      return aTitle.localeCompare(bTitle);
    });

  return {
    official: removed.filter(isOfficialRecoveryEntry),
    other: removed.filter((entry) => !isOfficialRecoveryEntry(entry)),
  };
}

export function subscriptionRecoveryTargetHref(
  entry: UserSubscriptionListEntryDTO,
) {
  const targetType = String(entry.subscribedType);
  switch (targetType) {
    case "BOOK":
      return `/book/${entry.subscribedUnitId}`;
    case "POST":
      return `/post/${entry.subscribedUnitId}`;
    case "QUOTE":
      return `/excerpt/${entry.subscribedUnitId}`;
    case "POLL":
      return `/poll/${entry.subscribedUnitId}`;
    case "SHELF":
      return `/shelf/${entry.subscribedUnitId}`;
    case "USER":
    case "REALM":
    case "TAG":
    case "ZONE":
    case "ENTITY": {
      const prefix = SLUG_TARGET_PREFIX[targetType];
      return entry.subscribedSlug
        ? `/${prefix.short}/${entry.subscribedSlug}`
        : `/${prefix.long}/${entry.subscribedUnitId}`;
    }
    default:
      return entry.subscribedSlug
        ? `/unit/${entry.subscribedSlug}`
        : `/unit/id/${entry.subscribedUnitId}`;
  }
}

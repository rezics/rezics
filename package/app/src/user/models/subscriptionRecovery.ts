import type { UserSubscriptionListEntryDTO } from "@rezics/contract";
import { unitHref } from "@rezics/ui/primitive/link";

const OFFICIAL_RECOVERY_TARGETS = new Set([
  "REALM:rezics",
  "ZONE:book",
  "ZONE:realms",
  "ZONE:zones",
  "ZONE:popular",
]);

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
    case "POST":
    case "QUOTE":
    case "POLL":
    case "SHELF":
      return unitHref({ type: targetType, unitId: entry.subscribedUnitId });
    case "USER":
    case "REALM":
    case "TAG":
    case "ZONE":
    case "ENTITY":
      return unitHref({
        type: targetType,
        unitId: entry.subscribedUnitId,
        slug: entry.subscribedSlug ?? null,
      });
    default:
      return entry.subscribedSlug
        ? `/unit/${entry.subscribedSlug}`
        : `/unit/id/${entry.subscribedUnitId}`;
  }
}

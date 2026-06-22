import type { UserSubscriptionListEntryDTO } from "@rezics/contract";
import { unitHrefFromPartial } from "@rezics/ui/primitive/link";

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
  return unitHrefFromPartial(
    entry.subscribedType,
    entry.subscribedUnitId,
    entry.subscribedSlug,
  );
}

import { describe, expect, test } from "bun:test";
import type { UserSubscriptionListEntryDTO } from "@rezics/contract";
import {
  groupRecoveryEntries,
  isOfficialRecoveryEntry,
  subscriptionRecoveryTargetHref,
} from "./subscriptionRecovery";

const baseEntry: UserSubscriptionListEntryDTO = {
  id: "entry",
  userUnitId: "user-1",
  subscribedUnitId: "target-1",
  subscribedType: "ZONE",
  subscribedSlug: "custom",
  subscribedTitle: "Custom",
  position: "U",
  pinned: false,
  state: "REMOVED",
  createdAt: "2026-06-09T00:00:00.000Z",
  updatedAt: "2026-06-09T00:00:00.000Z",
};

function entry(
  overrides: Partial<UserSubscriptionListEntryDTO>,
): UserSubscriptionListEntryDTO {
  return { ...baseEntry, ...overrides };
}

describe("subscription recovery grouping", () => {
  test("classifies the Rezics realm and official zones as official recovery entries", () => {
    expect(
      isOfficialRecoveryEntry(
        entry({ subscribedType: "REALM", subscribedSlug: "rezics" }),
      ),
    ).toBe(true);
    expect(
      isOfficialRecoveryEntry(
        entry({ subscribedType: "ZONE", subscribedSlug: "book" }),
      ),
    ).toBe(true);
    expect(
      isOfficialRecoveryEntry(
        entry({ subscribedType: "ZONE", subscribedSlug: "popular" }),
      ),
    ).toBe(true);
    expect(
      isOfficialRecoveryEntry(
        entry({ subscribedType: "REALM", subscribedSlug: "fiction" }),
      ),
    ).toBe(false);
  });

  test("groups only removed entries and keeps official defaults separate", () => {
    const grouped = groupRecoveryEntries([
      entry({
        id: "active-official",
        subscribedType: "ZONE",
        subscribedSlug: "book",
        state: "ACTIVE",
      }),
      entry({
        id: "official-zone",
        subscribedType: "ZONE",
        subscribedSlug: "realms",
        subscribedTitle: "Realms",
      }),
      entry({
        id: "other-realm",
        subscribedType: "REALM",
        subscribedSlug: "fiction",
        subscribedTitle: "Fiction",
      }),
    ]);

    expect(grouped.official.map((item) => item.id)).toEqual(["official-zone"]);
    expect(grouped.other.map((item) => item.id)).toEqual(["other-realm"]);
  });

  test("builds target hrefs for slug-bearing and fallback recovery targets", () => {
    expect(
      subscriptionRecoveryTargetHref(
        entry({
          subscribedType: "ZONE",
          subscribedSlug: "book",
          subscribedUnitId: "zone-book",
        }),
      ),
    ).toBe("/z/book");
    expect(
      subscriptionRecoveryTargetHref(
        entry({
          subscribedType: "BOOK",
          subscribedSlug: "book-slug",
          subscribedUnitId: "book-1",
        }),
      ),
    ).toBe("/book/book-1");
    expect(
      subscriptionRecoveryTargetHref(
        entry({
          subscribedType: "LINK",
          subscribedSlug: null,
          subscribedUnitId: "link-1",
        }),
      ),
    ).toBe("/unit/id/link-1");
  });
});

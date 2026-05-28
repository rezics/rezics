import { describe, expect, test } from "bun:test";
import {
  type BroadcastEvent,
  resolveRecipients,
} from "./notify-boundary.client";

/**
 * Unit tests for the recipient resolver. The Prisma-backed
 * `defaultFindSubscriptionMatches` is replaced with an injected stub so
 * these tests verify the resolver's union/dedup logic without a DB.
 * Integration coverage of the three-tier GIN-indexed match query lives
 * with the migration verification scripts.
 */

function evt(partial: Partial<BroadcastEvent> = {}): BroadcastEvent {
  return {
    kind: "chapter.new",
    sourceUnitId: "00000000-0000-0000-0000-000000000001",
    ...partial,
  };
}

describe("resolveRecipients", () => {
  test("returns subscribers from findSubscriptionMatches", async () => {
    const recipients = await resolveRecipients(evt(), {
      findSubscriptionMatches: async () => ["sub-1", "sub-2"],
    });
    expect(recipients.sort()).toEqual(["sub-1", "sub-2"]);
  });

  test("unions directRecipients with subscription matches", async () => {
    const recipients = await resolveRecipients(
      evt({ directRecipients: ["direct-1", "direct-2"] }),
      { findSubscriptionMatches: async () => ["sub-1"] },
    );
    expect(recipients.sort()).toEqual(["direct-1", "direct-2", "sub-1"]);
  });

  test("dedupes when a direct recipient is also a subscriber", async () => {
    const recipients = await resolveRecipients(
      evt({ directRecipients: ["dup", "direct-only"] }),
      {
        findSubscriptionMatches: async () => ["dup", "sub-only"],
      },
    );
    expect(recipients.sort()).toEqual(["direct-only", "dup", "sub-only"]);
    expect(recipients).toHaveLength(3);
  });

  test("returns empty when no direct and no matches", async () => {
    const recipients = await resolveRecipients(evt(), {
      findSubscriptionMatches: async () => [],
    });
    expect(recipients).toEqual([]);
  });

  test("returns only directRecipients when subscription set is empty", async () => {
    const recipients = await resolveRecipients(
      evt({ directRecipients: ["a", "b"] }),
      { findSubscriptionMatches: async () => [] },
    );
    expect(recipients.sort()).toEqual(["a", "b"]);
  });

  test("directOnly skips subscription matches", async () => {
    const recipients = await resolveRecipients(
      evt({ directOnly: true, directRecipients: ["a", "b"] }),
      { findSubscriptionMatches: async () => ["sub-1"] },
    );
    expect(recipients.sort()).toEqual(["a", "b"]);
  });

  test("dedupes duplicate direct recipients", async () => {
    const recipients = await resolveRecipients(
      evt({ directRecipients: ["a", "a", "b"] }),
      { findSubscriptionMatches: async () => [] },
    );
    expect(recipients.sort()).toEqual(["a", "b"]);
  });

  test("passes sourceUnitId and kind through to the matcher", async () => {
    let seenTarget: string | undefined;
    let seenKind: string | undefined;
    await resolveRecipients(
      { kind: "review.updated", sourceUnitId: "book-42" },
      {
        findSubscriptionMatches: async (target, kind) => {
          seenTarget = target;
          seenKind = kind;
          return [];
        },
      },
    );
    expect(seenTarget).toBe("book-42");
    expect(seenKind).toBe("review.updated");
  });
});

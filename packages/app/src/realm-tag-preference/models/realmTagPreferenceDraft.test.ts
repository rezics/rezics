import { describe, expect, test } from "bun:test";
import {
  createRealmTagPreferenceDraft,
  pruneEmptyRealmTagPreferenceDraft,
  reorderRealmForTarget,
  setRealmForTarget,
} from "./realmTagPreferenceDraft";

describe("realmTagPreferenceDraft", () => {
  test("toggles the current realm without disturbing other target order", () => {
    const draft = createRealmTagPreferenceDraft({
      realmTagPreferences: {
        BOOK: { realmIds: ["realm-a", "realm-b"] },
        GAME: { realmIds: ["realm-c"] },
      },
    });

    const withRealm = setRealmForTarget(draft, "BOOK", "realm-c", true);
    expect(withRealm.BOOK.realmIds).toEqual(["realm-a", "realm-b", "realm-c"]);
    expect(withRealm.GAME.realmIds).toEqual(["realm-c"]);

    const withoutRealm = setRealmForTarget(withRealm, "BOOK", "realm-a", false);
    expect(withoutRealm.BOOK.realmIds).toEqual(["realm-b", "realm-c"]);
    expect(withoutRealm.GAME.realmIds).toEqual(["realm-c"]);
  });

  test("reorders a target list and prunes empty targets for save", () => {
    const draft = createRealmTagPreferenceDraft({
      realmTagPreferences: {
        BOOK: { realmIds: ["realm-a", "realm-b", "realm-c"] },
      },
    });

    const reordered = reorderRealmForTarget(
      draft,
      "BOOK",
      "realm-c",
      "realm-a",
    );

    expect(reordered.BOOK.realmIds).toEqual(["realm-c", "realm-a", "realm-b"]);
    expect(pruneEmptyRealmTagPreferenceDraft(reordered)).toEqual({
      BOOK: { realmIds: ["realm-c", "realm-a", "realm-b"] },
    });
  });
});

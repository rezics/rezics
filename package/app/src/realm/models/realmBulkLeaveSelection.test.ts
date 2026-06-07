import { describe, expect, test } from "bun:test";
import {
  selectedRealmItems,
  toggleRealmSelection,
} from "./realmBulkLeaveSelection";

const realms = [
  {
    unitId: "realm-a",
    slug: "a",
    title: "A",
    description: "",
    memberCount: 1,
    isOfficial: false,
    isPublic: true,
  },
  {
    unitId: "realm-b",
    slug: "b",
    title: "B",
    description: "",
    memberCount: 2,
    isOfficial: false,
    isPublic: true,
  },
];

describe("realm bulk leave selection", () => {
  test("toggles realm ids and returns only selected realms", () => {
    let selected = new Set<string>();
    selected = toggleRealmSelection(selected, "realm-a");
    selected = toggleRealmSelection(selected, "realm-b");
    selected = toggleRealmSelection(selected, "realm-a");

    expect([...selected]).toEqual(["realm-b"]);
    expect(
      selectedRealmItems(realms, selected).map((realm) => realm.unitId),
    ).toEqual(["realm-b"]);
  });
});

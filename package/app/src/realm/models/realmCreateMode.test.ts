import { describe, expect, test } from "bun:test";
import { PostKind } from "@rezics/contract";
import {
  buildRealmPollPostCreateInput,
  buildRealmPostCreateInput,
  buildRealmWikiCreateInput,
  defaultRealmCreateMode,
  normalizeRealmCreateMode,
  realmCreateModeLabel,
} from "./realmCreateMode";

describe("realm create mode helpers", () => {
  test("normalizes unknown modes to the default mode", () => {
    expect(defaultRealmCreateMode).toBe("post");
    expect(normalizeRealmCreateMode("wiki")).toBe("wiki");
    expect(normalizeRealmCreateMode("unknown")).toBe("post");
    expect(realmCreateModeLabel("poll")).toBe("Polls");
  });

  test("builds realm post creation input with realm, tags, kind, and status", () => {
    expect(
      buildRealmPostCreateInput({
        realmId: "realm-1",
        content: " hello ",
        tagIds: ["tag-1", "tag-2"],
        status: "PUBLISHED",
      }),
    ).toMatchObject({
      realmUnitIds: ["realm-1"],
      tagIds: ["tag-1", "tag-2"],
      kind: PostKind.POST,
      status: "PUBLISHED",
    });
  });

  test("builds realm wiki creation input with realm, language, content, and status", () => {
    expect(
      buildRealmWikiCreateInput({
        realmId: "realm-1",
        content: " wiki body ",
        language: "zh-hant",
        status: "DRAFT",
      }),
    ).toMatchObject({
      realmUnitIds: ["realm-1"],
      language: "zh-hant",
      status: "DRAFT",
    });
  });

  test("builds poll post input after the poll unit has been minted", () => {
    expect(
      buildRealmPollPostCreateInput({
        realmId: "realm-1",
        content: "poll body",
        tagIds: ["tag-1"],
        pollUnitId: "poll-1",
        status: "PUBLISHED",
      }),
    ).toMatchObject({
      realmUnitIds: ["realm-1"],
      tagIds: ["tag-1"],
      kind: PostKind.POST,
      status: "PUBLISHED",
      extra: { poll: { unitId: "poll-1" } },
    });
  });
});

import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  realmMembershipMeDTOSchema,
  realmMemberDTOSchema,
  realmRuleAcknowledgementDTOSchema,
  realmRuleAcknowledgementStatusSchema,
  realmRuleReferenceDTOSchema,
} from "./realm";
import { realmExtraSchema } from "./realm/realm-extra";

describe("realm community contract schemas", () => {
  test("realm extra accepts tag view preferences and multilingual tag tree labels", () => {
    expect(
      Value.Check(realmExtraSchema, {
        tagView: {
          defaultStyle: "grouped",
          allowViewerSwitch: true,
        },
        tagTree: [
          {
            labelUnitId: "group-label-unit-1",
            labelTranslations: {
              translations: {
                en: "Reading order",
                "zh-hant": "閱讀順序",
              },
              fallbackLanguage: "en",
            },
            disabled: true,
            children: [{ tagId: "tag-unit-1" }],
          },
        ],
      }),
    ).toBe(true);
  });

  test("realm extra rejects unknown tag view styles", () => {
    expect(
      Value.Check(realmExtraSchema, {
        tagView: {
          defaultStyle: "cards",
          allowViewerSwitch: true,
        },
      }),
    ).toBe(false);
  });

  test("realm member DTO can carry product member state", () => {
    expect(
      Value.Check(realmMemberDTOSchema, {
        realmUnitId: "realm-1",
        userId: "user-1",
        roleKey: "member",
        state: "muted",
      }),
    ).toBe(true);

    expect(
      Value.Check(realmMemberDTOSchema, {
        realmUnitId: "realm-1",
        userId: "user-1",
        roleKey: "member",
        state: "silenced",
      }),
    ).toBe(false);
  });

  test("realm rule acknowledgement identity is versioned and locale invariant", () => {
    expect(
      Value.Check(realmRuleReferenceDTOSchema, {
        realmUnitId: "realm-1",
        ruleUnitId: "rule-unit-2",
        version: 3,
        requireOnJoin: true,
        requireOnPost: true,
      }),
    ).toBe(true);

    expect(
      Value.Check(realmRuleAcknowledgementDTOSchema, {
        realmUnitId: "realm-1",
        ruleUnitId: "rule-unit-1",
        version: 2,
        userId: "user-1",
        acceptedAt: "2026-05-28T00:00:00.000Z",
        acceptedLanguage: "en",
      }),
    ).toBe(true);

    expect(
      Value.Check(realmRuleAcknowledgementStatusSchema, {
        currentRuleUnitId: "rule-unit-2",
        requiredVersion: 3,
        acceptedRuleUnitId: "rule-unit-1",
        acceptedVersion: 2,
        acceptedAt: "2026-05-28T00:00:00.000Z",
        acceptedLanguage: "ja",
        acknowledgementRequired: true,
      }),
    ).toBe(true);
  });

  test("current membership DTO carries state, capability hints, and rule acknowledgement", () => {
    expect(
      Value.Check(realmMembershipMeDTOSchema, {
        realmUnitId: "realm-1",
        userId: "user-1",
        member: {
          realmUnitId: "realm-1",
          userId: "user-1",
          roleKey: "member",
          state: "muted",
        },
        roleKey: "member",
        state: "muted",
        muted: true,
        banned: false,
        capabilities: [
          {
            capability: "tag.curate",
            scope: { kind: "realm", realmUnitId: "realm-1" },
          },
        ],
        ruleAcknowledgement: {
          currentRuleUnitId: "rule-unit-2",
          requiredVersion: 1,
          acceptedRuleUnitId: "rule-unit-1",
          acceptedVersion: 4,
          acknowledgementRequired: true,
        },
      }),
    ).toBe(true);
  });
});

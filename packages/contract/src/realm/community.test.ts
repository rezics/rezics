import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { markdownContentDoc } from "../content/doc-v1";
import { realmTagTreeV1Schema } from "./realm-tag-tree";
import {
  realmMemberDTOSchema,
  realmMembershipMeDTOSchema,
  realmRuleAcknowledgementDTOSchema,
  realmRuleAcknowledgementStatusSchema,
  realmRulePolicyDTOSchema,
  realmRuleResolvedDTOSchema,
} from "./realm";

describe("realm community contract schemas", () => {
  test("realm tag tree accepts label and tag nodes without durable node ids", () => {
    expect(
      Value.Check(realmTagTreeV1Schema, {
        schema: "rezics/realm-tag-tree",
        version: 1,
        view: { defaultMode: "tree", allowViewerSwitch: true },
        nodes: [
          {
            kind: "label",
            labelUnitId: "label-unit-1",
            children: [
              {
                kind: "tag",
                tagUnitId: "tag-unit-1",
                labelUnitId: "label-unit-2",
                querySource: "policy",
              },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  test("realm tag tree rejects node ids and inline labels", () => {
    expect(
      Value.Check(realmTagTreeV1Schema, {
        schema: "rezics/realm-tag-tree",
        version: 1,
        view: { defaultMode: "tree", allowViewerSwitch: true },
        nodes: [{ kind: "label", id: "node-1", label: "Genre" }],
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
      Value.Check(realmRulePolicyDTOSchema, {
        realmUnitId: "realm-1",
        policyId: "policy-1",
        currentRevisionId: "revision-3",
        currentVersion: 3,
        requirements: {
          requireOnJoin: true,
          requireOnPost: true,
          requireOnUpdate: true,
        },
      }),
    ).toBe(true);

    expect(
      Value.Check(realmRuleAcknowledgementDTOSchema, {
        realmUnitId: "realm-1",
        policyId: "policy-1",
        revisionId: "revision-2",
        version: 2,
        userId: "user-1",
        acceptedAt: "2026-05-28T00:00:00.000Z",
        acceptedLanguage: "en",
      }),
    ).toBe(true);

    expect(
      Value.Check(realmRuleAcknowledgementStatusSchema, {
        currentPolicyId: "policy-1",
        currentRevisionId: "revision-3",
        requiredVersion: 3,
        acceptedPolicyId: "policy-1",
        acceptedRevisionId: "revision-2",
        acceptedVersion: 2,
        acceptedAt: "2026-05-28T00:00:00.000Z",
        acceptedLanguage: "ja",
        acknowledgementRequired: true,
      }),
    ).toBe(true);

    expect(
      Value.Check(realmRuleResolvedDTOSchema, {
        policy: {
          realmUnitId: "realm-1",
          policyId: "policy-1",
          currentRevisionId: "revision-3",
          currentVersion: 3,
          requirements: {
            requireOnJoin: true,
            requireOnPost: true,
            requireOnUpdate: true,
          },
        },
        revision: {
          id: "revision-3",
          policyId: "policy-1",
          version: 3,
          items: [
            {
              id: "item-1",
              policyId: "policy-1",
              revisionId: "revision-3",
              rulePostUnitId: "rule-post-en",
              position: "0001",
            },
          ],
        },
        items: [
          {
            id: "item-1",
            rulePostUnitId: "rule-post-en",
            position: "0001",
            requestedLanguage: "ja",
            resolvedLanguage: "en",
            sourceRulePost: {
              unitId: "rule-post-en",
              authorUserId: "owner-1",
              content: markdownContentDoc("Follow the rules"),
            },
          },
        ],
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
          currentPolicyId: "policy-1",
          currentRevisionId: "revision-1",
          requiredVersion: 1,
          acceptedPolicyId: "policy-1",
          acceptedRevisionId: "revision-0",
          acceptedVersion: 4,
          acknowledgementRequired: true,
        },
      }),
    ).toBe(true);
  });
});

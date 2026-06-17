import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { policyActionSchema } from "../permission";
import { tagTreeNodeSchema } from "../realm/realm-extra";
import {
  createPolicyTagRuleSchema,
  policyTagAuthoritySchema,
  policyTagRuleDTOSchema,
  policyTagScopeSchema,
} from "./policy-tag";
import { tagFilterSchema, tagUnitDTOSchema } from "./tag";

describe("policy tag contracts", () => {
  test("accepts global and realm scopes", () => {
    expect(Value.Check(policyTagScopeSchema, { kind: "global" })).toBe(true);
    expect(
      Value.Check(policyTagScopeSchema, {
        kind: "realm",
        realmUnitId: "realm-1",
      }),
    ).toBe(true);
    expect(Value.Check(policyTagScopeSchema, { kind: "realm" })).toBe(false);
  });

  test("exposes authority as read-only effective governance data", () => {
    expect(
      Value.Check(policyTagAuthoritySchema, {
        ruleManageAction: "tag.policy.rule.manage",
        applicationManageAction: "tag.policy.application.manage",
        requiredCapability: "tag.curate",
      }),
    ).toBe(true);
    expect(Value.Check(policyActionSchema, "tag.policy.rule.manage")).toBe(
      true,
    );
    expect(
      Value.Check(policyActionSchema, "tag.policy.application.manage"),
    ).toBe(true);
  });

  test("rule create input rejects arbitrary capability configuration", () => {
    expect(
      Value.Check(createPolicyTagRuleSchema, {
        scope: { kind: "realm", realmUnitId: "realm-1" },
        tagUnitId: "tag-1",
        requiredCapability: "audit.read",
      }),
    ).toBe(false);
  });

  test("rule DTO carries effective authority", () => {
    expect(
      Value.Check(policyTagRuleDTOSchema, {
        id: "rule-1",
        scope: { kind: "realm", realmUnitId: "realm-1" },
        tagUnitId: "tag-1",
        state: "active",
        authority: {
          ruleManageAction: "tag.policy.rule.manage",
          applicationManageAction: "tag.policy.application.manage",
          requiredCapability: "tag.curate",
        },
        createdByUserId: "user-1",
        updatedByUserId: null,
        reason: null,
        createdAt: "2026-06-17T00:00:00.000Z",
        updatedAt: "2026-06-17T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  test("tag query source is a caller-selected filter property", () => {
    expect(
      Value.Check(tagFilterSchema, {
        tagUnitId: "tag-1",
      }),
    ).toBe(true);
    expect(
      Value.Check(tagFilterSchema, {
        tagUnitId: "tag-1",
        source: "policy",
      }),
    ).toBe(true);
  });

  test("tag tree may hint policy query source without constraining tagging", () => {
    expect(
      Value.Check(tagTreeNodeSchema, {
        tagId: "tag-1",
        querySource: "policy",
      }),
    ).toBe(true);
  });

  test("tag identity DTO is separate from scored UnitTag applications", () => {
    expect(
      Value.Check(tagUnitDTOSchema, {
        unitId: "tag-1",
        slug: "notice",
        label: "Notice",
        visual: {
          color: "#DB515C",
          avatarUrl: "https://cdn.example/tag.png",
          iconSvg: "<svg />",
        },
        translations: [],
      }),
    ).toBe(true);
    expect(
      Value.Check(tagUnitDTOSchema, {
        unitId: "tag-1",
        score: 1,
        voteCount: 1,
      }),
    ).toBe(false);
  });
});

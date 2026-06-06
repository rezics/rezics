import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  capabilitySchema,
  decisionCodeSchema,
  policyActionSchema,
  policyInputSchema,
  realmMemberRoleAtLeast,
  realmMemberRoleSchema,
  wouldRemoveLastRealmOwner,
} from "../permission";
import {
  postDTOSchema,
  postModerationOverlayRequestSchema,
  postModerationOverlayResponseSchema,
} from "../post/post";
import {
  accountEnforcementDTOSchema,
  appealModerationCaseSchema,
  assignModerationCaseSchema,
  contentModerationDecisionSchema,
  createAccountEnforcementSchema,
  createModerationCaseFromFeedbackSchema,
  createRealmModerationCaseFromFeedbackSchema,
  createRealmModerationCaseSchema,
  decideModerationCaseSchema,
  decideRealmModerationCaseSchema,
  duplicateModerationCaseSchema,
  escalateRealmModerationCaseSchema,
  grantCapabilitySchema,
  moderationActionDTOSchema,
  moderationCaseDTOSchema,
  moderationOverlayRequestSchema,
  staffAuditLogDTOSchema,
  triageModerationCaseSchema,
  unblockAccountEnforcementSchema,
} from "./governance";
import { realmMemberDTOSchema, unitRealmDTOSchema } from "./realm";

describe("governance contract registry", () => {
  test("accepts closed capability and decision code keys", () => {
    expect(Value.Check(capabilitySchema, "account.ban")).toBe(true);
    expect(Value.Check(capabilitySchema, "account.unblock")).toBe(true);
    expect(Value.Check(capabilitySchema, "moderation.case.decide")).toBe(true);
    expect(Value.Check(capabilitySchema, "content.pin")).toBe(true);
    expect(Value.Check(capabilitySchema, "comment.moderate")).toBe(true);
    expect(Value.Check(capabilitySchema, "realm.member.moderate")).toBe(true);
    expect(Value.Check(capabilitySchema, "moderation.decide")).toBe(false);

    expect(Value.Check(decisionCodeSchema, "ALLOWED")).toBe(true);
    expect(Value.Check(decisionCodeSchema, "MISSING_CAPABILITY")).toBe(true);
    expect(Value.Check(decisionCodeSchema, "LEAK_INTERNAL_REASON")).toBe(false);

    expect(Value.Check(policyActionSchema, "realm.create")).toBe(true);
    expect(Value.Check(policyActionSchema, "dm.send")).toBe(true);
    expect(Value.Check(policyActionSchema, "reaction.create")).toBe(true);
    expect(Value.Check(policyActionSchema, "content.pin")).toBe(true);
    expect(Value.Check(policyActionSchema, "comment.moderate")).toBe(true);
    expect(Value.Check(policyActionSchema, "realm.rules.update")).toBe(true);
    expect(Value.Check(policyActionSchema, "realm.member.moderate")).toBe(true);
    expect(Value.Check(policyActionSchema, "tag.vote")).toBe(true);
    expect(Value.Check(policyActionSchema, "reaction.destroy")).toBe(false);
  });

  test("policy input carries resolved capabilities and active enforcement", () => {
    expect(
      Value.Check(policyInputSchema, {
        actorUserId: "user-1",
        action: "content.create",
        capabilities: [
          {
            capability: "content.takedown",
            scope: { kind: "realm", realmUnitId: "realm-1" },
          },
        ],
        activeEnforcement: {
          targetUserId: "user-1",
          activeKinds: ["silence"],
          strongestKind: "silence",
          expiresAt: null,
        },
        realmMembership: {
          realmUnitId: "realm-1",
          role: "moderator",
          capabilities: [
            {
              capability: "queue.realm.decide",
              scope: { kind: "realm", realmUnitId: "realm-1" },
            },
          ],
        },
        target: {
          kind: "post",
          id: "post-1",
          ownerUserId: "user-2",
          realmUnitId: "realm-1",
        },
      }),
    ).toBe(true);
  });

  test("realm member role hierarchy protects the last owner", () => {
    expect(Value.Check(realmMemberRoleSchema, "owner")).toBe(true);
    expect(realmMemberRoleAtLeast("admin", "moderator")).toBe(true);
    expect(realmMemberRoleAtLeast("member", "moderator")).toBe(false);
    expect(
      wouldRemoveLastRealmOwner({
        currentRole: "owner",
        nextRole: "admin",
        ownerCount: 1,
      }),
    ).toBe(true);
  });

  test("realm member DTO can carry a capability subset", () => {
    expect(
      Value.Check(realmMemberDTOSchema, {
        realmUnitId: "realm-1",
        userId: "user-1",
        roleKey: "moderator",
        capabilities: [
          {
            capability: "queue.realm.decide",
            scope: { kind: "realm", realmUnitId: "realm-1" },
          },
        ],
      }),
    ).toBe(true);
  });

  test("account enforcement, moderation cases, actions, and audit DTOs validate", () => {
    expect(
      Value.Check(accountEnforcementDTOSchema, {
        id: "enforcement-1",
        targetUserId: "user-1",
        kind: "ban",
        state: "active",
        reason: "abuse",
        safeMessage: "This account is restricted.",
        decidedByUserId: "staff-1",
        decisionCode: "ALLOWED",
        startsAt: "2026-05-28T00:00:00.000Z",
        expiresAt: null,
        revokedAt: null,
        decisionActionId: "action-1",
        revocationActionId: null,
        createdAt: "2026-05-28T00:00:00.000Z",
        updatedAt: "2026-05-28T00:00:00.000Z",
      }),
    ).toBe(true);

    expect(
      Value.Check(moderationCaseDTOSchema, {
        id: "case-1",
        scope: "realm",
        state: "new",
        reporterUserId: "user-2",
        subjectUserId: "user-1",
        target: { kind: "unit", id: "post-1", realmUnitId: "realm-1" },
        parentCaseId: null,
        sourceFeedbackId: "feedback-1",
        reason: "harassment",
        createdAt: "2026-05-28T00:00:00.000Z",
        updatedAt: "2026-05-28T00:00:00.000Z",
      }),
    ).toBe(true);

    expect(
      Value.Check(moderationActionDTOSchema, {
        id: "action-1",
        authority: "realm",
        realmUnitId: "realm-1",
        targetKind: "unit",
        targetId: "post-1",
        actorKind: "user",
        actorUserId: "staff-1",
        actionKind: "remove",
        resultingStatus: "removed",
        resultingLocked: null,
        reasonCode: "ALLOWED",
        reasonText: "harassment",
        caseId: "case-1",
        reversesActionId: null,
        requestId: null,
        importedFrom: null,
        createdAt: "2026-05-28T00:00:00.000Z",
      }),
    ).toBe(true);

    expect(
      Value.Check(staffAuditLogDTOSchema, {
        id: "audit-1",
        actorUserId: "staff-1",
        action: "account.ban",
        targetKind: "user",
        targetId: "user-1",
        decisionCode: "ALLOWED",
        requestId: "req-1",
        reason: "abuse",
        metadata: { state: "banned" },
        createdAt: "2026-05-28T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  test("content moderation decision and UnitRealm DTOs validate", () => {
    expect(
      Value.Check(contentModerationDecisionSchema, {
        reason: "off-topic",
        caseId: "case-1",
        metadata: { source: "realm-case" },
      }),
    ).toBe(true);
    expect(
      Value.Check(contentModerationDecisionSchema, {
        reason: "off-topic",
        content: { body: "moderation must not edit bodies" },
      }),
    ).toBe(false);

    expect(
      Value.Check(unitRealmDTOSchema, {
        realmUnitId: "realm-1",
        unitId: "reply-1",
        moderationStatus: "approved",
        isLocked: false,
        createdAt: "2026-05-28T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  test("post moderation overlay contracts validate", () => {
    expect(
      Value.Check(postDTOSchema, {
        unitId: "reply-1",
        authorUserId: "user-1",
        content: null,
        moderationStatus: "removed",
        isTombstone: true,
      }),
    ).toBe(true);

    expect(
      Value.Check(moderationOverlayRequestSchema, {
        targetKind: "unit_realm",
        realmUnitId: "realm-1",
        targetIds: ["reply-1", "reply-2"],
      }),
    ).toBe(true);

    expect(
      Value.Check(postModerationOverlayRequestSchema, {
        realmUnitId: "realm-1",
        targetUnitIds: ["reply-1", "reply-2"],
      }),
    ).toBe(true);

    expect(
      Value.Check(postModerationOverlayResponseSchema, {
        overlays: [
          {
            id: "reply-1",
            moderationStatus: "removed",
            latestAction: null,
          },
        ],
      }),
    ).toBe(true);
  });

  test("account enforcement command contracts validate", () => {
    expect(
      Value.Check(createAccountEnforcementSchema, {
        kind: "silence",
        reason: "spam",
        safeMessage: "Posting is temporarily restricted.",
        expiresAt: "2026-05-29T00:00:00.000Z",
        caseId: "case-1",
        metadata: { caseId: "case-1" },
      }),
    ).toBe(true);

    expect(
      Value.Check(createAccountEnforcementSchema, {
        kind: "deleted",
        reason: "spam",
      }),
    ).toBe(false);

    expect(
      Value.Check(unblockAccountEnforcementSchema, {
        reason: "appeal approved",
        caseId: "case-1",
        metadata: { caseId: "case-1" },
      }),
    ).toBe(true);
  });

  test("moderation case command contracts validate", () => {
    expect(
      Value.Check(createModerationCaseFromFeedbackSchema, {
        severity: "medium",
        metadata: { source: "report" },
      }),
    ).toBe(true);
    expect(
      Value.Check(duplicateModerationCaseSchema, {
        duplicateOfCaseId: "case-parent",
        reason: "same target and facts",
      }),
    ).toBe(true);
    expect(
      Value.Check(assignModerationCaseSchema, {
        assignedToUserId: "staff-2",
      }),
    ).toBe(true);
    expect(
      Value.Check(triageModerationCaseSchema, {
        severity: "high",
        assignedToUserId: null,
      }),
    ).toBe(true);
    expect(
      Value.Check(decideModerationCaseSchema, {
        state: "actioned",
        reason: "policy violation confirmed",
        decision: { allowed: true, code: "ALLOWED" },
      }),
    ).toBe(true);
    expect(
      Value.Check(appealModerationCaseSchema, {
        reason: "appeal received",
      }),
    ).toBe(true);
  });

  test("realm scoped case command contracts validate", () => {
    expect(
      Value.Check(createRealmModerationCaseSchema, {
        reporterUserId: "reporter-1",
        subjectUserId: "subject-1",
        targetKind: "unit",
        targetId: "post-1",
        addressedUnitId: "post-1",
        reason: "reported",
      }),
    ).toBe(true);
    expect(
      Value.Check(createRealmModerationCaseFromFeedbackSchema, {
        reason: "reported",
        metadata: { source: "feedback" },
      }),
    ).toBe(true);
    expect(
      Value.Check(decideRealmModerationCaseSchema, {
        actionKind: "remove",
        reason: "off-topic",
      }),
    ).toBe(true);
    expect(
      Value.Check(escalateRealmModerationCaseSchema, {
        reason: "site review needed",
        caseId: "case-1",
      }),
    ).toBe(true);
  });

  test("capability grant command contract validates", () => {
    expect(
      Value.Check(grantCapabilitySchema, {
        capability: "queue.realm.decide",
        expiresAt: "2026-05-29T00:00:00.000Z",
      }),
    ).toBe(true);

    expect(
      Value.Check(grantCapabilitySchema, {
        capability: "queue.realm.destroy",
      }),
    ).toBe(false);
  });
});

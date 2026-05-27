import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  accountEnforcementDTOSchema,
  appealModerationCaseSchema,
  assignModerationCaseSchema,
  contentModerationDecisionSchema,
  contentModerationStateDTOSchema,
  createAccountEnforcementSchema,
  createModerationCaseFromFeedbackSchema,
  decideModerationCaseSchema,
  duplicateModerationCaseSchema,
  grantCapabilitySchema,
  moderationCaseDTOSchema,
  realmContentModerationDTOSchema,
  realmModerationQueueItemDTOSchema,
  staffAuditLogDTOSchema,
  triageModerationCaseSchema,
  unblockAccountEnforcementSchema,
} from "./governance";
import {
  capabilitySchema,
  decisionCodeSchema,
  policyActionSchema,
  policyInputSchema,
  realmMemberRoleAtLeast,
  realmMemberRoleSchema,
  wouldRemoveLastRealmOwner,
} from "./permission";
import {
  postModerationOverlayRequestSchema,
  postModerationOverlayResponseSchema,
  postDTOSchema,
} from "./post";
import { realmMemberDTOSchema } from "./realm";

describe("governance contract registry", () => {
  test("accepts closed capability and decision code keys", () => {
    expect(Value.Check(capabilitySchema, "account.ban")).toBe(true);
    expect(Value.Check(capabilitySchema, "moderation.case.decide")).toBe(true);
    expect(Value.Check(capabilitySchema, "moderation.decide")).toBe(false);

    expect(Value.Check(decisionCodeSchema, "ALLOWED")).toBe(true);
    expect(Value.Check(decisionCodeSchema, "MISSING_CAPABILITY")).toBe(true);
    expect(Value.Check(decisionCodeSchema, "LEAK_INTERNAL_REASON")).toBe(false);

    expect(Value.Check(policyActionSchema, "realm.create")).toBe(true);
    expect(Value.Check(policyActionSchema, "dm.send")).toBe(true);
    expect(Value.Check(policyActionSchema, "reaction.create")).toBe(true);
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

  test("account enforcement, cases, realm queue, and audit DTOs validate", () => {
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
        auditLogId: "audit-1",
        createdAt: "2026-05-28T00:00:00.000Z",
        updatedAt: "2026-05-28T00:00:00.000Z",
      }),
    ).toBe(true);

    expect(
      Value.Check(moderationCaseDTOSchema, {
        id: "case-1",
        state: "new",
        reporterUserId: "user-2",
        subjectUserId: "user-1",
        target: { kind: "post", id: "post-1", realmUnitId: "realm-1" },
        sourceFeedbackId: "feedback-1",
        reason: "harassment",
        createdAt: "2026-05-28T00:00:00.000Z",
        updatedAt: "2026-05-28T00:00:00.000Z",
      }),
    ).toBe(true);

    expect(
      Value.Check(realmModerationQueueItemDTOSchema, {
        id: "realm-queue-1",
        realmUnitId: "realm-1",
        state: "new",
        target: { kind: "post", id: "post-1", realmUnitId: "realm-1" },
        linkedCaseId: null,
        createdAt: "2026-05-28T00:00:00.000Z",
        updatedAt: "2026-05-28T00:00:00.000Z",
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
        before: { state: "active" },
        after: { state: "banned" },
        createdAt: "2026-05-28T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  test("content moderation state DTOs validate", () => {
    expect(
      Value.Check(contentModerationDecisionSchema, {
        reason: "off-topic",
        caseId: "case-1",
        metadata: { source: "realm-queue" },
      }),
    ).toBe(true);
    expect(
      Value.Check(contentModerationDecisionSchema, {
        reason: "off-topic",
        content: { body: "moderation must not edit bodies" },
      }),
    ).toBe(false);

    expect(
      Value.Check(contentModerationStateDTOSchema, {
        targetUnitId: "reply-1",
        state: "hidden",
        decidedByUserId: "staff-1",
        caseId: "case-1",
        reason: "abuse",
        metadata: { source: "case" },
        createdAt: "2026-05-28T00:00:00.000Z",
        updatedAt: "2026-05-28T00:00:00.000Z",
      }),
    ).toBe(true);

    expect(
      Value.Check(realmContentModerationDTOSchema, {
        realmUnitId: "realm-1",
        targetUnitId: "reply-1",
        state: "tombstoned",
        decidedByUserId: "mod-1",
        reason: "off-topic",
        createdAt: "2026-05-28T00:00:00.000Z",
        updatedAt: "2026-05-28T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  test("post moderation overlay contracts validate", () => {
    expect(
      Value.Check(postDTOSchema, {
        unitId: "reply-1",
        authorUserId: "user-1",
        content: null,
        globalModerationState: "tombstoned",
        isTombstone: true,
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
        globalStates: [
          {
            targetUnitId: "reply-1",
            state: "hidden",
            createdAt: "2026-05-28T00:00:00.000Z",
            updatedAt: "2026-05-28T00:00:00.000Z",
          },
        ],
        realmOverlays: [
          {
            realmUnitId: "realm-1",
            targetUnitId: "reply-2",
            state: "tombstoned",
            createdAt: "2026-05-28T00:00:00.000Z",
            updatedAt: "2026-05-28T00:00:00.000Z",
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

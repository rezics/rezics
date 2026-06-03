import { describe, expect, mock, test } from "bun:test";
import {
  ModerationActionService,
  validateModerationActionInput,
} from "./moderation-action.service";

function validAction(overrides: Record<string, unknown> = {}) {
  return {
    authority: "PLATFORM",
    targetKind: "UNIT",
    targetId: "unit-1",
    actorKind: "USER",
    actorUserId: "staff-1",
    actionKind: "REMOVE",
    resultingStatus: "REMOVED",
    reasonCode: "moderation.remove",
    ...overrides,
  } as never;
}

describe("moderation action validation", () => {
  test("accepts snapshot status actions only for snapshot-backed targets", () => {
    expect(() => validateModerationActionInput(validAction())).not.toThrow();

    expect(() =>
      validateModerationActionInput(
        validAction({ targetKind: "FEEDBACK", targetId: "feedback-1" }),
      ),
    ).toThrow("REMOVE is not allowed for FEEDBACK");
  });

  test("requires typed resulting fields for snapshot mutations", () => {
    expect(() =>
      validateModerationActionInput(
        validAction({ actionKind: "APPROVE", resultingStatus: undefined }),
      ),
    ).toThrow("APPROVE requires resultingStatus");

    expect(() =>
      validateModerationActionInput(
        validAction({
          actionKind: "LOCK",
          resultingStatus: undefined,
          resultingLocked: undefined,
        }),
      ),
    ).toThrow("LOCK requires resultingLocked");
  });

  test("rejects unrelated snapshot fields on account actions", () => {
    expect(() =>
      validateModerationActionInput(
        validAction({
          targetKind: "ACCOUNT",
          targetId: "user-1",
          actionKind: "SUSPENSION",
          resultingStatus: "REMOVED",
        }),
      ),
    ).toThrow("SUSPENSION must not carry resultingStatus");
  });

  test("allows workflow notes to carry optional snapshot context", () => {
    expect(() =>
      validateModerationActionInput(
        validAction({
          authority: "REALM",
          realmUnitId: "realm-1",
          targetKind: "UNIT_REALM",
          actionKind: "NOTE",
          resultingStatus: "PENDING",
        }),
      ),
    ).not.toThrow();
  });

  test("returns existing idempotent action without appending", async () => {
    const existing = { id: "action-1" };
    const tx = {
      moderationAction: {
        findUnique: mock(async () => existing),
        create: mock(async () => ({ id: "created-action" })),
      },
    };
    const service = new ModerationActionService();

    await expect(
      service.appendModerationAction(
        tx,
        validAction({ idempotencyKey: "request-1" }),
      ),
    ).resolves.toBe(existing);
    expect(tx.moderationAction.create).not.toHaveBeenCalled();
  });
});

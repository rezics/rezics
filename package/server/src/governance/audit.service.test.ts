import { beforeEach, describe, expect, mock, test } from "bun:test";
import type {
  GovernanceAuditRepository,
  GovernanceAuditService,
} from "./audit.service";

const auditRow = {
  id: "audit-1",
  actorUserId: "staff-1",
  action: "session.revoke",
  targetKind: "session",
  targetId: "session-1",
  decisionCode: "ALLOWED",
  requestId: "req-1",
  reason: "compromised session",
  metadata: {
    credential: "raw-credential",
    sessionId: "safe-session-id",
    nested: {
      privateNote: "internal note",
      visible: "safe",
    },
  },
  createdAt: new Date("2026-05-28T00:00:00.000Z"),
};

beforeEach(() => {
  list.mockClear();
  get.mockClear();
});

const list = mock(async () => [auditRow]);
const get = mock(async () => auditRow);

function createRepository(): GovernanceAuditRepository {
  return {
    create: mock(async (input) => ({
      ...auditRow,
      ...input,
      requestId: input.requestId ?? null,
      metadata: input.metadata ?? null,
    })),
    list,
    get,
  };
}

async function createService(): Promise<GovernanceAuditService> {
  const { GovernanceAuditService } = await import("./audit.service");
  return new GovernanceAuditService(createRepository());
}

describe("GovernanceAuditService", () => {
  test("lists audit records with filters and redacts sensitive fields", async () => {
    const rows = await (await createService()).list({
      actorUserId: "staff-1",
      action: "session.revoke",
      targetKind: "session",
      targetId: "session-1",
      decisionCode: "ALLOWED",
      requestId: "req-1",
      offset: 10,
      limit: 5,
    });

    expect(list).toHaveBeenCalledWith({
      actorUserId: "staff-1",
      action: "session.revoke",
      targetKind: "session",
      targetId: "session-1",
      decisionCode: "ALLOWED",
      requestId: "req-1",
      offset: 10,
      limit: 5,
    });
    expect(rows[0]).toMatchObject({
      metadata: {
        credential: "[REDACTED]",
        sessionId: "safe-session-id",
        nested: {
          privateNote: "[REDACTED]",
          visible: "safe",
        },
      },
    });
  });

  test("reads one audit record through the same redaction path", async () => {
    const row = await (await createService()).get("audit-1");

    expect(get).toHaveBeenCalledWith("audit-1");
    expect(row?.metadata?.credential).toBe("[REDACTED]");
    expect(
      (row?.metadata?.nested as Record<string, unknown>)?.privateNote,
    ).toBe("[REDACTED]");
  });
});

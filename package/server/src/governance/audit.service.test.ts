import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  installPrismaClientMock,
  prismaMock,
} from "../test/prisma-client-mock";

installPrismaClientMock();

const auditRow = {
  id: "audit-1",
  actorUserId: "staff-1",
  action: "session.revoke",
  targetKind: "session",
  targetId: "session-1",
  decisionCode: "ALLOWED",
  requestId: "req-1",
  reason: "compromised session",
  before: {
    accessToken: "raw-access-token",
    nested: {
      privateNote: "internal note",
      visible: "safe",
    },
  },
  after: {
    state: "revoked",
    stackTrace: "Error: sensitive stack",
  },
  metadata: {
    credential: "raw-credential",
    sessionId: "safe-session-id",
  },
  createdAt: new Date("2026-05-28T00:00:00.000Z"),
};

beforeEach(() => {
  prismaMock.staffAuditLog = {
    findMany: mock(async () => [auditRow]),
    findUnique: mock(async () => auditRow),
  };
});

describe("GovernanceAuditService", () => {
  test("lists audit records with filters and redacts sensitive fields", async () => {
    const { governanceAuditService } = await import("./audit.service");

    const rows = await governanceAuditService.list({
      actorUserId: "staff-1",
      action: "session.revoke",
      targetKind: "session",
      targetId: "session-1",
      decisionCode: "ALLOWED",
      requestId: "req-1",
      offset: 10,
      limit: 5,
    });

    expect(prismaMock.staffAuditLog.findMany).toHaveBeenCalledWith({
      where: {
        actorUserId: "staff-1",
        action: "session.revoke",
        targetKind: "session",
        targetId: "session-1",
        decisionCode: "ALLOWED",
        requestId: "req-1",
      },
      orderBy: { createdAt: "desc" },
      skip: 10,
      take: 5,
    });
    expect(rows[0]).toMatchObject({
      before: {
        accessToken: "[REDACTED]",
        nested: {
          privateNote: "[REDACTED]",
          visible: "safe",
        },
      },
      after: {
        state: "revoked",
        stackTrace: "[REDACTED]",
      },
      metadata: {
        credential: "[REDACTED]",
        sessionId: "safe-session-id",
      },
    });
  });

  test("reads one audit record through the same redaction path", async () => {
    const { governanceAuditService } = await import("./audit.service");

    const row = await governanceAuditService.get("audit-1");

    expect(prismaMock.staffAuditLog.findUnique).toHaveBeenCalledWith({
      where: { id: "audit-1" },
    });
    expect(row?.before?.accessToken).toBe("[REDACTED]");
    expect(row?.after?.stackTrace).toBe("[REDACTED]");
    expect(row?.metadata?.credential).toBe("[REDACTED]");
  });
});

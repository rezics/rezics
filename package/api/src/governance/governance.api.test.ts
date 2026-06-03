import { beforeEach, describe, expect, mock, test } from "bun:test";
import { configureApi } from "../config";
import { governanceApi } from "./governance.api";
import { governanceKeys } from "./governance.keys";
import {
  invalidateGovernanceCaseQueries,
  invalidateGovernanceEnforcementQueries,
  invalidateRealmCapabilityQueries,
  invalidateRealmContentModerationQueries,
  invalidateRealmQueueQueries,
} from "./governance.mutations";

const fetchMock = mock();

configureApi({
  apiBaseUrl: "http://api.example",
  authBaseUrl: "http://auth.example",
  reactionServiceUrl: "http://reaction.example",
});

describe("governanceApi", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "result-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test("builds staff case and audit read requests", async () => {
    await governanceApi.listCases({ offset: 5, limit: 10 });
    await governanceApi.getCase("case/1");
    await governanceApi.listEscalatedRealmQueue({ limit: 8 });
    await governanceApi.listAudit({
      action: "session.revoke",
      targetKind: "session",
      targetId: "session-1",
    });
    await governanceApi.getAudit("audit/1");

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/governance/cases?offset=5&limit=10",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "http://api.example/governance/cases/case%2F1",
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "http://api.example/governance/realm-queue/escalated?limit=8",
    );
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      "http://api.example/governance/audit?action=session.revoke&targetKind=session&targetId=session-1",
    );
    expect(fetchMock.mock.calls[4]?.[0]).toBe(
      "http://api.example/governance/audit/audit%2F1",
    );
  });

  test("sends governance mutation requests to typed endpoints", async () => {
    await governanceApi.applyEnforcement("user/1", {
      kind: "ban",
      reason: "abuse",
    });
    await governanceApi.assignCase("case/1", {
      assignedToUserId: "staff-2",
      reason: "handoff",
    });
    await governanceApi.decideRealmQueueItem("realm/1", "queue/1", {
      decisionKind: "hide_from_realm",
      reason: "off topic",
    });
    await governanceApi.grantRealmCapability("realm/1", "user/1", {
      capability: "queue.realm.decide",
    });
    await governanceApi.tombstoneRealmContent("realm/1", "post/1", {
      reason: "spam",
    });
    await governanceApi.restoreRealmContent("realm/1", "post/1", {
      reason: "appeal accepted",
    });
    await governanceApi.removeRealmFeedRoot("realm/1", "post/1");
    await governanceApi.requestRealmContentOwnerDelegation(
      "realm/1",
      "post/1",
      {
        reason: "owner review",
      },
    );

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/governance/enforcement/user%2F1",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "http://api.example/governance/cases/case%2F1/assign",
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "http://api.example/governance/realms/realm%2F1/queue/queue%2F1/decision",
    );
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      "http://api.example/governance/realms/realm%2F1/members/user%2F1/capabilities",
    );
    expect(fetchMock.mock.calls[4]?.[0]).toBe(
      "http://api.example/governance/realms/realm%2F1/content/post%2F1/tombstone",
    );
    expect(fetchMock.mock.calls[5]?.[0]).toBe(
      "http://api.example/governance/realms/realm%2F1/content/post%2F1/restore",
    );
    expect(fetchMock.mock.calls[6]?.[0]).toBe(
      "http://api.example/governance/realms/realm%2F1/feed/post%2F1",
    );
    expect(fetchMock.mock.calls[6]?.[1]).toMatchObject({ method: "DELETE" });
    expect(fetchMock.mock.calls[7]?.[0]).toBe(
      "http://api.example/governance/realms/realm%2F1/content/post%2F1/owner-delegation",
    );
  });

  test("exposes stable governance keys and invalidation helpers", () => {
    expect(governanceKeys.caseDetail("case-1")).toEqual([
      "governance",
      "cases",
      "detail",
      "case-1",
    ]);
    expect(governanceKeys.auditList({ action: "session.revoke" })).toEqual([
      "governance",
      "audit",
      "list",
      { action: "session.revoke" },
    ]);
    expect(governanceKeys.realmQueueEscalated({ limit: 8 })).toEqual([
      "governance",
      "realm-queue",
      "escalated",
      { limit: 8 },
    ]);

    const queryClient = {
      invalidateQueries: mock(async () => undefined),
    };

    invalidateGovernanceCaseQueries(queryClient, "case-1");
    invalidateGovernanceEnforcementQueries(queryClient, "user-1");
    invalidateRealmCapabilityQueries(queryClient, "realm-1");
    invalidateRealmQueueQueries(queryClient, "realm-1", "queue-1");
    invalidateRealmContentModerationQueries(queryClient, "realm-1", "post-1");

    expect(
      (queryClient.invalidateQueries.mock.calls as any[]).map(
        (call) => call[0],
      ),
    ).toEqual([
      { queryKey: ["governance", "cases"] },
      { queryKey: ["governance", "cases", "detail", "case-1"] },
      { queryKey: ["governance", "enforcement", "list", "user-1", undefined] },
      { queryKey: ["governance", "enforcement", "active", "user-1"] },
      { queryKey: ["governance", "capability-hints"] },
      { queryKey: ["realms", "members", "realm-1"] },
      { queryKey: ["governance", "realms", "realm-1", "queue"] },
      {
        queryKey: [
          "governance",
          "realms",
          "realm-1",
          "queue",
          "detail",
          "queue-1",
        ],
      },
      {
        queryKey: [
          "governance",
          "realms",
          "realm-1",
          "content",
          "post-1",
          "moderation",
        ],
      },
      { queryKey: ["posts", "realm", "realm-1"] },
      { queryKey: ["posts", "moderation-overlays", "realm-1", ["post-1"]] },
    ]);
  });
});

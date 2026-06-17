import { beforeEach, describe, expect, mock, test } from "bun:test";

const calls: Array<{ url: string; init?: RequestInit }> = [];

mock.module("../react-query/http", () => ({
  apiFetch: mock(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return {};
  }),
}));

describe("policyTagApi", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  test("serializes rule list scope filters", async () => {
    const { policyTagApi } = await import("./policy-tag.api");

    await policyTagApi.listRules({
      scopeKind: "realm",
      realmUnitId: "realm-1",
      tagUnitId: "tag-1",
      state: "active",
      limit: 20,
      offset: 40,
    });

    expect(calls[0]?.url).toBe(
      "/policy-tag/rules?scopeKind=realm&realmUnitId=realm-1&tagUnitId=tag-1&state=active&limit=20&offset=40",
    );
  });

  test("writes policy tag rules through dedicated CRUD routes", async () => {
    const { policyTagApi } = await import("./policy-tag.api");

    await policyTagApi.createRule({
      scope: { kind: "realm", realmUnitId: "realm-1" },
      tagUnitId: "tag-1",
      reason: "curated",
    });
    await policyTagApi.updateRule("rule/1", {
      state: "archived",
      reason: "retired",
    });

    expect(calls.map((call) => call.url)).toEqual([
      "/policy-tag/rules",
      "/policy-tag/rules/rule%2F1",
    ]);
    expect(calls.map((call) => call.init?.method)).toEqual(["POST", "PATCH"]);
    expect(calls.map((call) => call.init?.body)).toEqual([
      JSON.stringify({
        scope: { kind: "realm", realmUnitId: "realm-1" },
        tagUnitId: "tag-1",
        reason: "curated",
      }),
      JSON.stringify({ state: "archived", reason: "retired" }),
    ]);
  });

  test("serializes application list filters independently from ordinary tags", async () => {
    const { policyTagApi } = await import("./policy-tag.api");

    await policyTagApi.listApplications({
      ruleId: "rule-1",
      scopeKind: "global",
      tagUnitId: "tag-1",
      unitId: "unit-1",
      limit: 10,
    });

    expect(calls[0]?.url).toBe(
      "/policy-tag/applications?ruleId=rule-1&scopeKind=global&tagUnitId=tag-1&unitId=unit-1&limit=10",
    );
  });

  test("writes policy applications under policy-tag routes", async () => {
    const { policyTagApi } = await import("./policy-tag.api");

    await policyTagApi.upsertApplication("rule/1", {
      unitId: "unit-1",
      position: "a",
      metadata: { source: "curated" },
    });
    await policyTagApi.patchApplication("rule/1", "unit/1", {
      position: null,
    });
    await policyTagApi.deleteApplication("rule/1", "unit/1");

    expect(calls.map((call) => call.url)).toEqual([
      "/policy-tag/rules/rule%2F1/applications",
      "/policy-tag/rules/rule%2F1/applications/unit%2F1",
      "/policy-tag/rules/rule%2F1/applications/unit%2F1",
    ]);
    expect(calls.map((call) => call.init?.method)).toEqual([
      "POST",
      "PATCH",
      "DELETE",
    ]);
    expect(calls.map((call) => call.init?.body)).toEqual([
      JSON.stringify({
        unitId: "unit-1",
        position: "a",
        metadata: { source: "curated" },
      }),
      JSON.stringify({ position: null }),
      undefined,
    ]);
  });
});

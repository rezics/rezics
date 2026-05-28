import { describe, expect, test } from "bun:test";
import { decide } from "./policy";

describe("governance policy", () => {
  test("allows when the required global capability is present", () => {
    expect(
      decide({
        actorUserId: "staff-1",
        permission: { role: "ADMIN" },
        action: "account.ban",
        capabilities: [
          { capability: "account.ban", scope: { kind: "global" } },
        ],
      }),
    ).toMatchObject({ allowed: true, code: "ALLOWED" });
  });

  test("denies when a required capability is missing", () => {
    expect(
      decide({
        actorUserId: "staff-1",
        permission: { role: "ADMIN" },
        action: "account.ban",
        capabilities: [],
      }),
    ).toMatchObject({ allowed: false, code: "MISSING_CAPABILITY" });
  });

  test("denies staff-plane actions without a staff role tier", () => {
    expect(
      decide({
        actorUserId: "user-1",
        permission: { role: "USER" },
        action: "account.ban",
        capabilities: [
          { capability: "account.ban", scope: { kind: "global" } },
        ],
      }),
    ).toMatchObject({ allowed: false, code: "INSUFFICIENT_ROLE" });
  });

  test("root implicitly holds all staff capabilities", () => {
    expect(
      decide({
        actorUserId: "root-1",
        permission: { role: "ROOT" },
        action: "account.ban",
        capabilities: [],
      }),
    ).toMatchObject({ allowed: true, code: "ALLOWED" });
  });

  test("denies content creation under active silence enforcement", () => {
    expect(
      decide({
        actorUserId: "user-1",
        action: "content.create",
        capabilities: [],
        activeEnforcement: {
          targetUserId: "user-1",
          activeKinds: ["silence"],
          strongestKind: "silence",
          expiresAt: null,
        },
      }),
    ).toMatchObject({ allowed: false, code: "ENFORCEMENT_ACTIVE" });
  });

  test("denies community mutation actions under active silence enforcement", () => {
    for (const action of [
      "realm.create",
      "dm.send",
      "tag.vote",
      "reaction.create",
    ] as const) {
      expect(
        decide({
          actorUserId: "user-1",
          action,
          capabilities: [],
          activeEnforcement: {
            targetUserId: "user-1",
            activeKinds: ["silence"],
            strongestKind: "silence",
            expiresAt: null,
          },
        }),
      ).toMatchObject({ allowed: false, code: "ENFORCEMENT_ACTIVE" });
    }
  });

  test("denies actions against missing resources", () => {
    expect(
      decide({
        actorUserId: "staff-1",
        permission: { role: "ADMIN" },
        action: "case.triage",
        capabilities: [
          { capability: "moderation.case.triage", scope: { kind: "global" } },
        ],
        context: { missingResource: true },
      }),
    ).toMatchObject({ allowed: false, code: "MISSING_RESOURCE" });
  });

  test("denies banned accounts before action-family capability checks", () => {
    expect(
      decide({
        actorUserId: "user-1",
        action: "content.create",
        capabilities: [],
        activeEnforcement: {
          targetUserId: "user-1",
          activeKinds: ["ban"],
          strongestKind: "ban",
          expiresAt: null,
        },
      }),
    ).toMatchObject({ allowed: false, code: "BLOCKED_ACCOUNT" });
  });

  test("allows case, audit, operation, content, and realm action families", () => {
    const common = {
      actorUserId: "staff-1",
      permission: { role: "ADMIN" as const },
    };

    expect(
      decide({
        ...common,
        action: "case.decide",
        capabilities: [
          { capability: "moderation.case.decide", scope: { kind: "global" } },
        ],
      }),
    ).toMatchObject({ allowed: true, code: "ALLOWED" });

    expect(
      decide({
        ...common,
        action: "audit.read",
        capabilities: [{ capability: "audit.read", scope: { kind: "global" } }],
      }),
    ).toMatchObject({ allowed: true, code: "ALLOWED" });

    expect(
      decide({
        ...common,
        action: "operation.repair.run",
        capabilities: [{ capability: "audit.read", scope: { kind: "global" } }],
      }),
    ).toMatchObject({ allowed: true, code: "ALLOWED" });

    expect(
      decide({
        actorUserId: "moderator-1",
        permission: { role: "USER" },
        action: "content.pin",
        capabilities: [
          {
            capability: "content.pin",
            scope: { kind: "realm", realmUnitId: "realm-1" },
          },
        ],
        target: { kind: "post", id: "post-1", realmUnitId: "realm-1" },
      }),
    ).toMatchObject({ allowed: true, code: "ALLOWED" });

    expect(
      decide({
        actorUserId: "moderator-1",
        permission: { role: "USER" },
        action: "content.restore",
        capabilities: [
          {
            capability: "content.restore",
            scope: { kind: "realm", realmUnitId: "realm-1" },
          },
        ],
        target: { kind: "post", id: "post-1", realmUnitId: "realm-1" },
      }),
    ).toMatchObject({ allowed: true, code: "ALLOWED" });

    expect(
      decide({
        actorUserId: "moderator-1",
        permission: { role: "USER" },
        action: "realm.member.capability.change",
        capabilities: [],
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
          kind: "realm-member-capability",
          id: "user-2",
          realmUnitId: "realm-1",
        },
      }),
    ).toMatchObject({ allowed: true, code: "ALLOWED" });
  });

  test("denies cross-realm realm-family decisions", () => {
    expect(
      decide({
        actorUserId: "moderator-1",
        permission: { role: "USER" },
        action: "realm.member.role.change",
        capabilities: [],
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
          kind: "realm-member",
          id: "user-2",
          realmUnitId: "realm-2",
        },
      }),
    ).toMatchObject({ allowed: false, code: "CROSS_REALM_DENIED" });
  });

  test("denies realm-scoped grants for the wrong realm", () => {
    expect(
      decide({
        actorUserId: "moderator-1",
        permission: { role: "USER" },
        action: "content.takedown",
        capabilities: [
          {
            capability: "content.takedown",
            scope: { kind: "realm", realmUnitId: "realm-1" },
          },
        ],
        target: { kind: "post", id: "post-1", realmUnitId: "realm-2" },
      }),
    ).toMatchObject({ allowed: false, code: "MISSING_CAPABILITY" });
  });
});

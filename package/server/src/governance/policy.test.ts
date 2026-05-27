import { describe, expect, test } from "bun:test";
import { decide } from "./policy";

describe("governance policy", () => {
  test("allows when the required global capability is present", () => {
    expect(
      decide({
        actorUserId: "staff-1",
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
        action: "account.ban",
        capabilities: [],
      }),
    ).toMatchObject({ allowed: false, code: "MISSING_CAPABILITY" });
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
});

import { describe, expect, mock, test } from "bun:test";
import {
  type RezicsSessionClaims,
  UnitAuthorityRoleKey,
} from "@rezics/contract";
import {
  assertCanEditUnitFields,
  canEditUnitFields,
  type UnitAuthorityError,
} from "./authority";

function actor(
  userId: string,
  role: "USER" | "ADMIN" | "ROOT" = "USER",
): RezicsSessionClaims {
  return { userId, permission: { role } } as RezicsSessionClaims;
}

function lookupStub(input?: {
  collaboratorRole?: UnitAuthorityRoleKey | string | null;
  locks?: string[];
}) {
  return {
    findCollaboratorRole: mock(async () => input?.collaboratorRole ?? null),
    listFieldLockPaths: mock(async () => input?.locks ?? []),
  };
}

const collaborative = { collaborative: true };
const notCollaborative = { collaborative: false };
const unit = { id: "unit-1", userId: "owner-1" };

describe("canEditUnitFields", () => {
  test("type alone does not grant community edit on non-collaborative surfaces", async () => {
    const lookup = lookupStub();

    const decision = await canEditUnitFields(
      actor("user-2"),
      unit,
      ["translations.en.title"],
      notCollaborative,
      { lookup, verifyAdmin: async () => false },
    );

    expect(decision).toMatchObject({
      allowed: false,
      code: "SURFACE_NOT_COLLABORATIVE",
    });
    expect(lookup.listFieldLockPaths).not.toHaveBeenCalled();
  });

  test("locked fields block rezics-wiki-owned community edits", async () => {
    const lookup = lookupStub({ locks: ["translations.en.title"] });

    const decision = await canEditUnitFields(
      actor("user-2"),
      { id: "unit-1", userId: "rezics-wiki-user" },
      ["translations.en.title"],
      collaborative,
      { lookup, verifyAdmin: async () => false },
    );

    expect(decision).toMatchObject({
      allowed: false,
      code: "FIELD_LOCKED",
      blockedPaths: ["translations.en.title"],
      offendingLockPath: "translations.en.title",
      offendingPatchPath: "translations.en.title",
    });
  });

  test("whole-object lock blocks any community field edit", async () => {
    const lookup = lookupStub({ locks: ["*"] });

    const decision = await canEditUnitFields(
      actor("user-2"),
      unit,
      ["post.content.main.source"],
      collaborative,
      { lookup, verifyAdmin: async () => false },
    );

    expect(decision).toMatchObject({
      allowed: false,
      code: "FIELD_LOCKED",
      blockedPaths: ["*"],
      offendingLockPath: "*",
      offendingPatchPath: "post.content.main.source",
    });
  });

  test("primary owner bypasses locks", async () => {
    const lookup = lookupStub({ locks: ["*"] });

    const decision = await canEditUnitFields(
      actor("owner-1"),
      unit,
      ["translations.en.title"],
      collaborative,
      { lookup, verifyAdmin: async () => false },
    );

    expect(decision).toMatchObject({
      allowed: true,
      reason: "primary-owner",
    });
    expect(lookup.listFieldLockPaths).not.toHaveBeenCalled();
  });

  test("maintainer collaborator bypasses locks", async () => {
    const lookup = lookupStub({
      collaboratorRole: UnitAuthorityRoleKey.MAINTAINER,
      locks: ["*"],
    });

    const decision = await canEditUnitFields(
      actor("user-2"),
      unit,
      ["translations.en.title"],
      collaborative,
      { lookup, verifyAdmin: async () => false },
    );

    expect(decision).toMatchObject({
      allowed: true,
      reason: "collaborator",
      collaboratorRole: UnitAuthorityRoleKey.MAINTAINER,
    });
    expect(lookup.listFieldLockPaths).not.toHaveBeenCalled();
  });

  test("admin override bypasses locks and requests audit metadata", async () => {
    const lookup = lookupStub({ locks: ["*"] });

    const decision = await canEditUnitFields(
      actor("admin-1", "ADMIN"),
      unit,
      ["translations.en.title"],
      collaborative,
      { lookup, verifyAdmin: async () => false },
    );

    expect(decision).toMatchObject({
      allowed: true,
      reason: "admin-override",
      auditOverride: true,
    });
    expect(lookup.listFieldLockPaths).not.toHaveBeenCalled();
  });

  test("ordinary post-style surfaces short-circuit before lock lookup", async () => {
    const lookup = lookupStub({ locks: ["*"] });

    const decision = await canEditUnitFields(
      actor("user-2"),
      unit,
      ["post.content.main.source"],
      notCollaborative,
      { lookup, verifyAdmin: async () => false },
    );

    expect(decision.allowed).toBe(false);
    expect(lookup.listFieldLockPaths).not.toHaveBeenCalled();
  });

  test("community edit is allowed for collaborative unlocked fields", async () => {
    const lookup = lookupStub();

    const decision = await canEditUnitFields(
      actor("user-2"),
      unit,
      ["translations.en.title"],
      collaborative,
      { lookup, verifyAdmin: async () => false },
    );

    expect(decision).toMatchObject({
      allowed: true,
      reason: "community-edit",
    });
    expect(lookup.listFieldLockPaths).toHaveBeenCalledTimes(1);
  });

  test("assert helper throws typed authority errors with blocked field keys", async () => {
    const lookup = lookupStub({ locks: ["post.content.main.source"] });

    await expect(
      assertCanEditUnitFields(
        actor("user-2"),
        unit,
        ["post.content.main.source"],
        collaborative,
        { lookup, verifyAdmin: async () => false },
      ),
    ).rejects.toMatchObject({
      name: "UnitAuthorityError",
      code: "FIELD_LOCKED",
      unitId: "unit-1",
      blockedPaths: ["post.content.main.source"],
      offendingLockPath: "post.content.main.source",
      offendingPatchPath: "post.content.main.source",
    } satisfies Partial<UnitAuthorityError>);
  });
});

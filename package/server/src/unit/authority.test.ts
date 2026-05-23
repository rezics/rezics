import { describe, expect, mock, test } from "bun:test";
import {
  UnitAuthorityRoleKey,
  type RezicsSessionClaims,
} from "@rezics/contract";
import {
  assertCanEditUnitFields,
  canEditUnitFields,
  UnitAuthorityError,
} from "./authority";

function actor(
  userId: string,
  role: "USER" | "ADMIN" | "ROOT" = "USER",
): RezicsSessionClaims {
  return { userId, permission: { role } } as RezicsSessionClaims;
}

function prismaStub(input?: {
  collaboratorRole?: UnitAuthorityRoleKey | string | null;
  locks?: string[];
}) {
  return {
    unitCollaborator: {
      findUnique: mock(async () =>
        input?.collaboratorRole ? { roleKey: input.collaboratorRole } : null,
      ),
    },
    unitFieldLock: {
      findMany: mock(async () =>
        (input?.locks ?? []).map((path) => ({ path })),
      ),
    },
  };
}

const collaborative = { collaborative: true };
const notCollaborative = { collaborative: false };
const unit = { id: "unit-1", userId: "owner-1" };

describe("canEditUnitFields", () => {
  test("type alone does not grant community edit on non-collaborative surfaces", async () => {
    const db = prismaStub();

    const decision = await canEditUnitFields(
      actor("user-2"),
      unit,
      ["translations.en.title"],
      notCollaborative,
      { prismaClient: db as never, verifyAdmin: async () => false },
    );

    expect(decision).toMatchObject({
      allowed: false,
      code: "SURFACE_NOT_COLLABORATIVE",
    });
    expect(db.unitFieldLock.findMany).not.toHaveBeenCalled();
  });

  test("locked fields block rezics-wiki-owned community edits", async () => {
    const db = prismaStub({ locks: ["translations.en.title"] });

    const decision = await canEditUnitFields(
      actor("user-2"),
      { id: "unit-1", userId: "rezics-wiki-user" },
      ["translations.en.title"],
      collaborative,
      { prismaClient: db as never, verifyAdmin: async () => false },
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
    const db = prismaStub({ locks: ["*"] });

    const decision = await canEditUnitFields(
      actor("user-2"),
      unit,
      ["post.content.main.source"],
      collaborative,
      { prismaClient: db as never, verifyAdmin: async () => false },
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
    const db = prismaStub({ locks: ["*"] });

    const decision = await canEditUnitFields(
      actor("owner-1"),
      unit,
      ["translations.en.title"],
      collaborative,
      { prismaClient: db as never, verifyAdmin: async () => false },
    );

    expect(decision).toMatchObject({
      allowed: true,
      reason: "primary-owner",
    });
    expect(db.unitFieldLock.findMany).not.toHaveBeenCalled();
  });

  test("maintainer collaborator bypasses locks", async () => {
    const db = prismaStub({
      collaboratorRole: UnitAuthorityRoleKey.MAINTAINER,
      locks: ["*"],
    });

    const decision = await canEditUnitFields(
      actor("user-2"),
      unit,
      ["translations.en.title"],
      collaborative,
      { prismaClient: db as never, verifyAdmin: async () => false },
    );

    expect(decision).toMatchObject({
      allowed: true,
      reason: "collaborator",
      collaboratorRole: UnitAuthorityRoleKey.MAINTAINER,
    });
    expect(db.unitFieldLock.findMany).not.toHaveBeenCalled();
  });

  test("admin override bypasses locks and requests audit metadata", async () => {
    const db = prismaStub({ locks: ["*"] });

    const decision = await canEditUnitFields(
      actor("admin-1", "ADMIN"),
      unit,
      ["translations.en.title"],
      collaborative,
      { prismaClient: db as never, verifyAdmin: async () => false },
    );

    expect(decision).toMatchObject({
      allowed: true,
      reason: "admin-override",
      auditOverride: true,
    });
    expect(db.unitFieldLock.findMany).not.toHaveBeenCalled();
  });

  test("ordinary post-style surfaces short-circuit before lock lookup", async () => {
    const db = prismaStub({ locks: ["*"] });

    const decision = await canEditUnitFields(
      actor("user-2"),
      unit,
      ["post.content.main.source"],
      notCollaborative,
      { prismaClient: db as never, verifyAdmin: async () => false },
    );

    expect(decision.allowed).toBe(false);
    expect(db.unitFieldLock.findMany).not.toHaveBeenCalled();
  });

  test("community edit is allowed for collaborative unlocked fields", async () => {
    const db = prismaStub();

    const decision = await canEditUnitFields(
      actor("user-2"),
      unit,
      ["translations.en.title"],
      collaborative,
      { prismaClient: db as never, verifyAdmin: async () => false },
    );

    expect(decision).toMatchObject({
      allowed: true,
      reason: "community-edit",
    });
    expect(db.unitFieldLock.findMany).toHaveBeenCalledTimes(1);
  });

  test("assert helper throws typed authority errors with blocked field keys", async () => {
    const db = prismaStub({ locks: ["post.content.main.source"] });

    await expect(
      assertCanEditUnitFields(
        actor("user-2"),
        unit,
        ["post.content.main.source"],
        collaborative,
        { prismaClient: db as never, verifyAdmin: async () => false },
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

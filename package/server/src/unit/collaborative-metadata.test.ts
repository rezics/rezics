import {
  UnitAuthorityRoleKey,
  type RezicsSessionClaims,
} from "@rezics/contract";
import { describe, expect, test } from "bun:test";
import { AppError } from "@/utils/errors";
import { assertCanEditCollaborativeMetadata } from "./collaborative-metadata";

const actor = (userId: string): RezicsSessionClaims =>
  ({
    userId,
    permission: { role: "USER" },
  }) as RezicsSessionClaims;

function makeTx(input: {
  ownerId?: string;
  locks?: string[];
  collaboratorRole?: UnitAuthorityRoleKey;
}) {
  const calls = { lockLookups: 0 };
  const tx = {
    unit: {
      findUniqueOrThrow: async () => ({
        id: "unit-1",
        userId: input.ownerId ?? "owner-1",
      }),
    },
    unitCollaborator: {
      findUnique: async () =>
        input.collaboratorRole ? { roleKey: input.collaboratorRole } : null,
    },
    unitFieldLock: {
      findMany: async () => {
        calls.lockLookups += 1;
        return (input.locks ?? []).map((path) => ({ path }));
      },
    },
  };
  return { tx: tx as never, calls };
}

const noAdminLookup = { verifyAdmin: async () => false };

describe("assertCanEditCollaborativeMetadata", () => {
  test("locked attribution fields reject community edits", async () => {
    const { tx } = makeTx({
      locks: ["credits.authors"],
    });

    await expect(
      assertCanEditCollaborativeMetadata(
        tx,
        actor("community-1"),
        "unit-1",
        ["credits.authors"],
        noAdminLookup,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FIELD_LOCKED",
      details: {
        blockedPaths: ["credits.authors"],
        offendingLockPath: "credits.authors",
        offendingPatchPath: "credits.authors",
      },
    } satisfies Partial<AppError>);
  });

  test("locked translation title fields reject community edits", async () => {
    const { tx } = makeTx({ locks: ["translations.en.title"] });

    await expect(
      assertCanEditCollaborativeMetadata(
        tx,
        actor("community-1"),
        "unit-1",
        ["translations.en.title"],
        noAdminLookup,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FIELD_LOCKED",
    } satisfies Partial<AppError>);
  });

  test("unlocked collaborative fields allow community edits", async () => {
    const { tx, calls } = makeTx({});

    await expect(
      assertCanEditCollaborativeMetadata(
        tx,
        actor("community-1"),
        "unit-1",
        ["translations.en.title"],
        noAdminLookup,
      ),
    ).resolves.toBeUndefined();
    expect(calls.lockLookups).toBe(1);
  });

  test("primary owner bypasses locks", async () => {
    const { tx, calls } = makeTx({
      ownerId: "owner-1",
      locks: ["translations.en.title"],
    });

    await expect(
      assertCanEditCollaborativeMetadata(
        tx,
        actor("owner-1"),
        "unit-1",
        ["translations.en.title"],
        noAdminLookup,
      ),
    ).resolves.toBeUndefined();
    expect(calls.lockLookups).toBe(0);
  });

  test("editor collaborator can edit unlocked collaborative fields", async () => {
    const { tx } = makeTx({
      collaboratorRole: UnitAuthorityRoleKey.EDITOR,
    });

    await expect(
      assertCanEditCollaborativeMetadata(
        tx,
        actor("editor-1"),
        "unit-1",
        ["translations.en.title"],
        noAdminLookup,
      ),
    ).resolves.toBeUndefined();
  });
});

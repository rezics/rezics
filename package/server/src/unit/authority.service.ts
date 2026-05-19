import type {
  CreateUnitFieldLockInput,
  RezicsSessionClaims,
  UnitAuthorityRoleKey,
  UnitCollaboratorDTO,
  UnitFieldLockDTO,
  UpsertUnitCollaboratorInput,
} from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { AppError } from "@/utils/errors";
import {
  canEditUnitFields,
  type AuthorityUnit,
  type CollaborativeSurfacePolicy,
} from "./authority";

type AuthorityDb = Pick<
  typeof prisma,
  "unit" | "unitCollaborator" | "unitFieldLock"
>;

const MANAGE_AUTHORITY_POLICY: CollaborativeSurfacePolicy = {
  collaborative: false,
  collaboratorRoles: ["owner", "maintainer"] as UnitAuthorityRoleKey[],
};

function toCollaboratorDTO(row: {
  unitId: string;
  userId: string;
  roleKey: string;
  addedById: string;
  createdAt: Date;
}): UnitCollaboratorDTO {
  return {
    unitId: row.unitId,
    userId: row.userId,
    roleKey: row.roleKey as UnitAuthorityRoleKey,
    addedById: row.addedById,
    createdAt: row.createdAt,
  };
}

function toLockDTO(row: {
  unitId: string;
  fieldKey: string;
  lockedById: string;
  reason: string | null;
  createdAt: Date;
}): UnitFieldLockDTO {
  return {
    unitId: row.unitId,
    fieldKey: row.fieldKey as UnitFieldLockDTO["fieldKey"],
    lockedById: row.lockedById,
    reason: row.reason,
    createdAt: row.createdAt,
  };
}

export class UnitAuthorityService {
  constructor(
    private readonly db: AuthorityDb = prisma,
    private readonly verifyAdmin?: (userId: string) => Promise<boolean>,
  ) {}

  private async getAuthorityUnit(unitId: string): Promise<AuthorityUnit> {
    const unit = await this.db.unit.findUnique({
      where: { id: unitId },
      select: { id: true, userId: true },
    });
    if (!unit) {
      throw new AppError(404, "Unit not found", { code: "UNIT_NOT_FOUND" });
    }
    return unit;
  }

  async assertCanManageAuthority(
    caller: RezicsSessionClaims,
    unitId: string,
  ): Promise<void> {
    const unit = await this.getAuthorityUnit(unitId);
    const decision = await canEditUnitFields(
      caller,
      unit,
      [],
      MANAGE_AUTHORITY_POLICY,
      { prismaClient: this.db, verifyAdmin: this.verifyAdmin },
    );

    if (!decision.allowed) {
      throw new AppError(403, "Forbidden: cannot manage Unit authority", {
        code: decision.code,
        details: {
          unitId,
          blockedFieldKeys: decision.blockedFieldKeys,
          collaboratorRole: decision.collaboratorRole,
        },
      });
    }
  }

  async listCollaborators(unitId: string): Promise<UnitCollaboratorDTO[]> {
    const rows = await this.db.unitCollaborator.findMany({
      where: { unitId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toCollaboratorDTO);
  }

  async upsertCollaborator(
    unitId: string,
    actor: RezicsSessionClaims,
    input: UpsertUnitCollaboratorInput,
  ): Promise<UnitCollaboratorDTO> {
    await this.assertCanManageAuthority(actor, unitId);
    const row = await this.db.unitCollaborator.upsert({
      where: { unitId_userId: { unitId, userId: input.userId } },
      update: { roleKey: input.roleKey, addedById: actor.userId },
      create: {
        unitId,
        userId: input.userId,
        roleKey: input.roleKey,
        addedById: actor.userId,
      },
    });
    return toCollaboratorDTO(row);
  }

  async removeCollaborator(
    unitId: string,
    actor: RezicsSessionClaims,
    userId: string,
  ): Promise<void> {
    await this.assertCanManageAuthority(actor, unitId);
    await this.db.unitCollaborator.delete({
      where: { unitId_userId: { unitId, userId } },
    });
  }

  async listFieldLocks(unitId: string): Promise<UnitFieldLockDTO[]> {
    const rows = await this.db.unitFieldLock.findMany({
      where: { unitId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toLockDTO);
  }

  async createFieldLock(
    unitId: string,
    actor: RezicsSessionClaims,
    input: CreateUnitFieldLockInput,
  ): Promise<UnitFieldLockDTO> {
    await this.assertCanManageAuthority(actor, unitId);
    const row = await this.db.unitFieldLock.upsert({
      where: { unitId_fieldKey: { unitId, fieldKey: input.fieldKey } },
      update: {
        lockedById: actor.userId,
        reason: input.reason ?? null,
      },
      create: {
        unitId,
        fieldKey: input.fieldKey,
        lockedById: actor.userId,
        reason: input.reason ?? null,
      },
    });
    return toLockDTO(row);
  }

  async deleteFieldLock(
    unitId: string,
    actor: RezicsSessionClaims,
    fieldKey: string,
  ): Promise<void> {
    await this.assertCanManageAuthority(actor, unitId);
    await this.db.unitFieldLock.delete({
      where: { unitId_fieldKey: { unitId, fieldKey } },
    });
  }
}

export const unitAuthorityService = new UnitAuthorityService();

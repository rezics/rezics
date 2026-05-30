import {
  type RezicsSessionClaims,
  SystemEmailKind,
  type WorkMembershipClaimDTO,
} from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma, UnitWorkDisplayPolicy, UnitWorkRole } from "#/prisma/client";
import { notifySystemAndEmail } from "@/notify-boundary/notify-boundary.client";
import { hasAuthorityOver } from "./authority";

export class WorkMembershipClaimError extends Error {
  constructor(
    public code:
      | "CLAIM_NOT_FOUND"
      | "FORBIDDEN"
      | "INVALID_STATUS"
      | "RELEASE_DELETED",
    message: string,
    public httpStatus: 400 | 403 | 404 | 409,
  ) {
    super(message);
    this.name = "WorkMembershipClaimError";
  }
}

type ClaimRow = Prisma.WorkLinkClaimGetPayload<{
  select: {
    id: true;
    releaseUnitId: true;
    workUnitId: true;
    claimerUserId: true;
    status: true;
    rejectReason: true;
    createdAt: true;
    resolvedAt: true;
    resolvedBy: true;
  };
}>;

const claimSelect = {
  id: true,
  releaseUnitId: true,
  workUnitId: true,
  claimerUserId: true,
  status: true,
  rejectReason: true,
  createdAt: true,
  resolvedAt: true,
  resolvedBy: true,
} satisfies Prisma.WorkLinkClaimSelect;

function toDTO(row: ClaimRow): WorkMembershipClaimDTO {
  return {
    id: row.id,
    releaseUnitId: row.releaseUnitId,
    workUnitId: row.workUnitId,
    claimerUserId: row.claimerUserId,
    status: row.status,
    rejectReason: row.rejectReason ?? undefined,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt ?? undefined,
    resolvedBy: row.resolvedBy ?? undefined,
  };
}

/**
 * Inbox listing for the work-side: returns claims for the given workUnitId.
 *
 * Claims whose release Unit is `status = DELETED` are filtered out at read
 * time (the rows remain in the DB).
 */
export async function listByWork(
  caller: RezicsSessionClaims,
  workUnitId: string,
  status?: WorkMembershipClaimDTO["status"],
): Promise<WorkMembershipClaimDTO[]> {
  const workUnit = await prisma.unit.findUnique({
    where: { id: workUnitId },
    select: { id: true, userId: true },
  });
  if (!workUnit) {
    throw new WorkMembershipClaimError(
      "CLAIM_NOT_FOUND",
      "Work unit not found",
      404,
    );
  }
  const authorized = await hasAuthorityOver(caller, {
    id: workUnit.id,
    userId: workUnit.userId,
  });
  if (!authorized) {
    throw new WorkMembershipClaimError(
      "FORBIDDEN",
      "Caller lacks authority over the work unit",
      403,
    );
  }

  const rows = await prisma.workLinkClaim.findMany({
    where: {
      workUnitId,
      ...(status ? { status } : {}),
      releaseUnit: { status: { not: "DELETED" } },
    },
    orderBy: { createdAt: "desc" },
    select: claimSelect,
  });
  return rows.map(toDTO);
}

async function loadClaimAndWork(claimId: string): Promise<{
  claim: ClaimRow;
  workUserId: string | null;
  releaseUserId: string | null;
}> {
  const claim = await prisma.workLinkClaim.findUnique({
    where: { id: claimId },
    select: {
      ...claimSelect,
      workUnit: { select: { userId: true } },
      releaseUnit: { select: { userId: true } },
    },
  });
  if (!claim) {
    throw new WorkMembershipClaimError(
      "CLAIM_NOT_FOUND",
      "Claim not found",
      404,
    );
  }
  const { workUnit, releaseUnit, ...rest } = claim;
  return {
    claim: rest,
    workUserId: workUnit?.userId ?? null,
    releaseUserId: releaseUnit?.userId ?? null,
  };
}

/**
 * Approve a PENDING claim: creates release UnitWork membership and marks
 * the claim APPROVED. Caller must have authority over the work-side unit.
 *
 * Returns the updated claim DTO.
 */
export async function approve(
  caller: RezicsSessionClaims,
  claimId: string,
): Promise<WorkMembershipClaimDTO> {
  const { claim, workUserId } = await loadClaimAndWork(claimId);
  if (claim.status !== "PENDING") {
    throw new WorkMembershipClaimError(
      "INVALID_STATUS",
      "Only PENDING claims can be approved",
      409,
    );
  }
  const authorized = await hasAuthorityOver(caller, {
    id: claim.workUnitId,
    userId: workUserId,
  });
  if (!authorized) {
    throw new WorkMembershipClaimError(
      "FORBIDDEN",
      "Caller lacks authority over the work unit",
      403,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.unitWork.upsert({
      where: {
        unitId_workUnitId_role: {
          unitId: claim.releaseUnitId,
          workUnitId: claim.workUnitId,
          role: UnitWorkRole.RELEASE,
        },
      },
      update: { displayPolicy: UnitWorkDisplayPolicy.PRIMARY },
      create: {
        unitId: claim.releaseUnitId,
        workUnitId: claim.workUnitId,
        role: UnitWorkRole.RELEASE,
        displayPolicy: UnitWorkDisplayPolicy.PRIMARY,
      },
    });
    return tx.workLinkClaim.update({
      where: { id: claimId },
      data: {
        status: "APPROVED",
        resolvedAt: new Date(),
        resolvedBy: caller.userId,
      },
      select: claimSelect,
    });
  });

  void notifySystemAndEmail({
    userId: claim.claimerUserId,
    kind: SystemEmailKind.WORK_MEMBERSHIP_CLAIM_APPROVED,
    payload: {
      claimId: claim.id,
      workUnitId: claim.workUnitId,
      releaseUnitId: claim.releaseUnitId,
    },
  });

  return toDTO(updated);
}

/**
 * Reject a PENDING claim: records rejection metadata; release link unchanged.
 * Caller must have authority over the work-side unit.
 */
export async function reject(
  caller: RezicsSessionClaims,
  claimId: string,
  reason?: string,
): Promise<WorkMembershipClaimDTO> {
  const { claim, workUserId } = await loadClaimAndWork(claimId);
  if (claim.status !== "PENDING") {
    throw new WorkMembershipClaimError(
      "INVALID_STATUS",
      "Only PENDING claims can be rejected",
      409,
    );
  }
  const authorized = await hasAuthorityOver(caller, {
    id: claim.workUnitId,
    userId: workUserId,
  });
  if (!authorized) {
    throw new WorkMembershipClaimError(
      "FORBIDDEN",
      "Caller lacks authority over the work unit",
      403,
    );
  }
  const updated = await prisma.workLinkClaim.update({
    where: { id: claimId },
    data: {
      status: "REJECTED",
      rejectReason: reason ?? null,
      resolvedAt: new Date(),
      resolvedBy: caller.userId,
    },
    select: claimSelect,
  });

  void notifySystemAndEmail({
    userId: claim.claimerUserId,
    kind: SystemEmailKind.WORK_MEMBERSHIP_CLAIM_REJECTED,
    payload: {
      claimId: claim.id,
      workUnitId: claim.workUnitId,
      releaseUnitId: claim.releaseUnitId,
      ...(reason ? { rejectReason: reason } : {}),
    },
  });

  return toDTO(updated);
}

/**
 * Withdraw a PENDING claim: only the original claimer may withdraw.
 */
export async function withdraw(
  caller: RezicsSessionClaims,
  claimId: string,
): Promise<WorkMembershipClaimDTO> {
  const { claim } = await loadClaimAndWork(claimId);
  if (claim.status !== "PENDING") {
    throw new WorkMembershipClaimError(
      "INVALID_STATUS",
      "Only PENDING claims can be withdrawn",
      409,
    );
  }
  if (claim.claimerUserId !== caller.userId) {
    throw new WorkMembershipClaimError(
      "FORBIDDEN",
      "Only the original claimer may withdraw a claim",
      403,
    );
  }
  const updated = await prisma.workLinkClaim.update({
    where: { id: claimId },
    data: {
      status: "WITHDRAWN",
      resolvedAt: new Date(),
    },
    select: claimSelect,
  });
  return toDTO(updated);
}

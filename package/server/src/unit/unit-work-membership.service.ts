import type { RezicsSessionClaims } from "@rezics/contract";
import { SystemEmailKind, WIKI_TYPES, type WikiType } from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { notifySystemAndEmail } from "@/notify-boundary/notify-boundary.client";
import { unitWorkService } from "@/unit-work";
import { hasAuthorityOver } from "./authority";

export interface UnitWorkMembershipResult {
  status: "LINKED" | "PENDING" | "UNLINKED";
  claimId?: string;
  autoApproved?: boolean;
}

export class UnitWorkMembershipError extends Error {
  constructor(
    public code:
      | "RELEASE_NOT_FOUND"
      | "WORK_NOT_FOUND"
      | "TYPE_MISMATCH"
      | "NESTING_FORBIDDEN"
      | "FORBIDDEN",
    message: string,
    public httpStatus: 400 | 403 | 404,
  ) {
    super(message);
    this.name = "UnitWorkMembershipError";
  }
}

const WIKI_TYPE_SET = new Set<WikiType>([...WIKI_TYPES]);

/**
 * Compatibility wrapper for release UnitWork membership mutations.
 *
 * - null `workUnitId` clears the link and cascades pending claims to WITHDRAWN
 * - immediate link when caller has work-side authority OR work is a wiki type
 * - otherwise creates a `membership claim` in PENDING status
 *
 * Returns `UnitWorkMembershipResult` describing the outcome; throws `UnitWorkMembershipError`
 * for validation/authority failures.
 */
export async function applyUnitWorkMembership(
  caller: RezicsSessionClaims,
  releaseId: string,
  workUnitId: string | null,
): Promise<UnitWorkMembershipResult> {
  const releaseUnit = await prisma.unit.findUnique({
    where: { id: releaseId },
    select: { id: true, type: true, userId: true },
  });
  if (!releaseUnit) {
    throw new UnitWorkMembershipError(
      "RELEASE_NOT_FOUND",
      "Release unit not found",
      404,
    );
  }

  const releaseAuthorized = await hasAuthorityOver(caller, {
    id: releaseUnit.id,
    userId: releaseUnit.userId,
  });
  if (!releaseAuthorized) {
    throw new UnitWorkMembershipError(
      "FORBIDDEN",
      "Caller lacks authority over the release unit",
      403,
    );
  }

  if (workUnitId === null) {
    await prisma.$transaction([
      prisma.unitWork.deleteMany({
        where: { unitId: releaseId, role: "RELEASE" },
      }),
      prisma.workLinkClaim.updateMany({
        where: { releaseUnitId: releaseId, status: "PENDING" },
        data: { status: "WITHDRAWN", resolvedAt: new Date() },
      }),
    ]);
    return { status: "UNLINKED" };
  }

  const workUnit = await prisma.unit.findUnique({
    where: { id: workUnitId },
    select: { id: true, type: true, userId: true },
  });
  if (!workUnit) {
    throw new UnitWorkMembershipError(
      "WORK_NOT_FOUND",
      "Work unit not found",
      400,
    );
  }
  if (workUnit.type !== releaseUnit.type) {
    throw new UnitWorkMembershipError(
      "TYPE_MISMATCH",
      "Release type must match work type",
      400,
    );
  }
  const workAuthorized = await hasAuthorityOver(caller, {
    id: workUnit.id,
    userId: workUnit.userId,
  });
  const isWikiType = WIKI_TYPE_SET.has(workUnit.type as WikiType);

  if (workAuthorized || isWikiType) {
    await unitWorkService.create({
      unitId: releaseId,
      workUnitId,
      role: "RELEASE",
      language: null,
      displayPolicy: "PRIMARY",
    });
    return {
      status: "LINKED",
      ...(workAuthorized ? {} : { autoApproved: true }),
    };
  }

  const existing = await prisma.workLinkClaim.findFirst({
    where: {
      releaseUnitId: releaseId,
      workUnitId,
      claimerUserId: caller.userId,
      status: "PENDING",
    },
    select: { id: true },
  });
  if (existing) {
    return { status: "PENDING", claimId: existing.id };
  }

  const claim = await prisma.workLinkClaim.create({
    data: {
      releaseUnitId: releaseId,
      workUnitId,
      claimerUserId: caller.userId,
      status: "PENDING",
    },
    select: { id: true },
  });

  if (workUnit.userId) {
    void notifySystemAndEmail({
      userId: workUnit.userId,
      kind: SystemEmailKind.WORK_MEMBERSHIP_CLAIM_PENDING,
      payload: {
        claimId: claim.id,
        claimerUserId: caller.userId,
        workUnitId,
        releaseUnitId: releaseId,
      },
    });
  }

  return { status: "PENDING", claimId: claim.id };
}

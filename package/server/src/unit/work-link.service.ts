import { SystemEmailKind, type WikiType, WIKI_TYPES } from "@rezics/contract";
import type { RezicsSessionClaims } from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { notifySystemAndEmail } from "../notify/notify-client";
import { hasAuthorityOver } from "./authority";

export interface WorkLinkResult {
  status: "LINKED" | "PENDING" | "UNLINKED";
  claimId?: string;
  autoApproved?: boolean;
}

export class WorkLinkError extends Error {
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
    this.name = "WorkLinkError";
  }
}

const WIKI_TYPE_SET = new Set<WikiType>([...WIKI_TYPES]);

/**
 * Implements the D5 decision tree for `PATCH /units/:releaseId/work-link`.
 *
 * - null `workUnitId` clears the link and cascades pending claims to WITHDRAWN
 * - immediate link when caller has work-side authority OR work is a wiki type
 * - otherwise creates a `WorkLinkClaim` in PENDING status
 *
 * Returns `WorkLinkResult` describing the outcome; throws `WorkLinkError`
 * for validation/authority failures.
 */
export async function applyWorkLink(
  caller: RezicsSessionClaims,
  releaseId: string,
  workUnitId: string | null,
): Promise<WorkLinkResult> {
  const releaseUnit = await prisma.unit.findUnique({
    where: { id: releaseId },
    select: { id: true, type: true, userId: true, workUnitId: true },
  });
  if (!releaseUnit) {
    throw new WorkLinkError("RELEASE_NOT_FOUND", "Release unit not found", 404);
  }

  const releaseAuthorized = await hasAuthorityOver(caller, {
    id: releaseUnit.id,
    userId: releaseUnit.userId,
  });
  if (!releaseAuthorized) {
    throw new WorkLinkError(
      "FORBIDDEN",
      "Caller lacks authority over the release unit",
      403,
    );
  }

  if (workUnitId === null) {
    await prisma.$transaction([
      prisma.unit.update({
        where: { id: releaseId },
        data: { workUnitId: null },
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
    select: { id: true, type: true, userId: true, workUnitId: true },
  });
  if (!workUnit) {
    throw new WorkLinkError("WORK_NOT_FOUND", "Work unit not found", 400);
  }
  if (workUnit.type !== releaseUnit.type) {
    throw new WorkLinkError(
      "TYPE_MISMATCH",
      "Release type must match work type",
      400,
    );
  }
  if (workUnit.workUnitId !== null) {
    throw new WorkLinkError(
      "NESTING_FORBIDDEN",
      "Cannot link a release to another release",
      400,
    );
  }

  const workAuthorized = await hasAuthorityOver(caller, {
    id: workUnit.id,
    userId: workUnit.userId,
  });
  const isWikiType = WIKI_TYPE_SET.has(workUnit.type as WikiType);

  if (workAuthorized || isWikiType) {
    await prisma.unit.update({
      where: { id: releaseId },
      data: { workUnitId },
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
      claimerUserId: caller.unitId,
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
      claimerUserId: caller.unitId,
      status: "PENDING",
    },
    select: { id: true },
  });

  if (workUnit.userId) {
    void notifySystemAndEmail({
      userId: workUnit.userId,
      kind: SystemEmailKind.WORK_LINK_CLAIM_PENDING,
      payload: {
        claimId: claim.id,
        claimerUserId: caller.unitId,
        workUnitId,
        releaseUnitId: releaseId,
      },
    });
  }

  return { status: "PENDING", claimId: claim.id };
}

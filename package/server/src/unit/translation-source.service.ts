import type {
  Language,
  RezicsSessionClaims,
  TranslationSourceResponse,
} from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma } from "#/prisma/client";
import { hasAuthorityOver } from "./authority";

export class TranslationSourceError extends Error {
  constructor(
    public code:
      | "WORK_NOT_FOUND"
      | "NOT_A_WORK"
      | "RELEASE_NOT_OF_WORK"
      | "FORBIDDEN",
    message: string,
    public httpStatus: 400 | 403 | 404,
  ) {
    super(message);
    this.name = "TranslationSourceError";
  }
}

/**
 * Set or clear `UnitTranslation.sourceUnitId` for `(workId, lang)`.
 *
 * Validations (per `unit-translation` spec):
 * - workUnit must exist and be a work (`workUnitId === null`)
 * - sourceUnitId, if set, must reference a release of this work
 *   (`releaseUnit.workUnitId === workId`)
 * - caller must have authority over the work
 *
 * Existing `title/subtitle/summary/description` fields are left untouched.
 */
export async function setTranslationSource(
  caller: RezicsSessionClaims,
  workId: string,
  language: string,
  sourceUnitId: string | null,
): Promise<TranslationSourceResponse> {
  const workUnit = await prisma.unit.findUnique({
    where: { id: workId },
    select: { id: true, userId: true, workUnitId: true },
  });
  if (!workUnit) {
    throw new TranslationSourceError(
      "WORK_NOT_FOUND",
      "Work unit not found",
      404,
    );
  }
  if (workUnit.workUnitId !== null) {
    throw new TranslationSourceError(
      "NOT_A_WORK",
      "Target unit is a release, not a work",
      400,
    );
  }

  const authorized = await hasAuthorityOver(caller, {
    id: workUnit.id,
    userId: workUnit.userId,
  });
  if (!authorized) {
    throw new TranslationSourceError(
      "FORBIDDEN",
      "Caller lacks authority over the work unit",
      403,
    );
  }

  if (sourceUnitId !== null) {
    const release = await prisma.unit.findUnique({
      where: { id: sourceUnitId },
      select: { workUnitId: true },
    });
    if (!release || release.workUnitId !== workId) {
      throw new TranslationSourceError(
        "RELEASE_NOT_OF_WORK",
        "sourceUnitId must reference a release of this work",
        400,
      );
    }
  }

  const create: Prisma.UnitTranslationCreateInput = {
    unit: { connect: { id: workId } },
    language,
    sourceUnitId,
  };

  const updated = await prisma.unitTranslation.upsert({
    where: { unitId_language: { unitId: workId, language } },
    create,
    update: { sourceUnitId },
    select: { unitId: true, language: true, sourceUnitId: true },
  });

  return {
    unitId: updated.unitId,
    language: updated.language as Language,
    sourceUnitId: updated.sourceUnitId,
  };
}

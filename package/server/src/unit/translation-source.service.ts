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
    public code: "UNIT_NOT_FOUND" | "SOURCE_UNIT_NOT_FOUND" | "FORBIDDEN",
    message: string,
    public httpStatus: 400 | 403 | 404,
  ) {
    super(message);
    this.name = "TranslationSourceError";
  }
}

/**
 * Set or clear `UnitTranslation.sourceUnitId` for `(unitId, lang)`.
 *
 * Validations:
 * - unit must exist
 * - sourceUnitId, if set, must reference an existing Unit
 * - caller must have authority over the target Unit
 *
 * Existing `title/subtitle/summary/description` fields are left untouched.
 */
export async function setTranslationSource(
  caller: RezicsSessionClaims,
  unitId: string,
  language: string,
  sourceUnitId: string | null,
): Promise<TranslationSourceResponse> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { id: true, userId: true },
  });
  if (!unit) {
    throw new TranslationSourceError("UNIT_NOT_FOUND", "Unit not found", 404);
  }
  const authorized = await hasAuthorityOver(caller, {
    id: unit.id,
    userId: unit.userId,
  });
  if (!authorized) {
    throw new TranslationSourceError(
      "FORBIDDEN",
      "Caller lacks authority over the unit",
      403,
    );
  }

  if (sourceUnitId !== null) {
    const sourceUnit = await prisma.unit.findUnique({
      where: { id: sourceUnitId },
      select: { id: true },
    });
    if (!sourceUnit) {
      throw new TranslationSourceError(
        "SOURCE_UNIT_NOT_FOUND",
        "sourceUnitId must reference an existing unit",
        404,
      );
    }
  }

  const create: Prisma.UnitTranslationCreateInput = {
    unit: { connect: { id: unitId } },
    language,
    sourceUnitId,
  };

  const updated = await prisma.unitTranslation.upsert({
    where: { unitId_language: { unitId, language } },
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

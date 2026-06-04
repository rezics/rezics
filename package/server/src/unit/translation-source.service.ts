import type {
  Language,
  RezicsSessionClaims,
  TranslationSourceResponse,
} from "@rezics/contract";
import { eq } from "drizzle-orm";
import { Unit, UnitTranslation } from "../db/schema";
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

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
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
  const db = await getServerDb();
  const [unit] = await db
    .select({ id: Unit.id, userId: Unit.userId })
    .from(Unit)
    .where(eq(Unit.id, unitId))
    .limit(1);
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
    const [sourceUnit] = await db
      .select({ id: Unit.id })
      .from(Unit)
      .where(eq(Unit.id, sourceUnitId))
      .limit(1);
    if (!sourceUnit) {
      throw new TranslationSourceError(
        "SOURCE_UNIT_NOT_FOUND",
        "sourceUnitId must reference an existing unit",
        404,
      );
    }
  }

  const now = new Date();
  const [updated] = await db
    .insert(UnitTranslation)
    .values({
      unitId,
      language,
      sourceUnitId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [UnitTranslation.unitId, UnitTranslation.language],
      set: { sourceUnitId, updatedAt: now },
    })
    .returning({
      unitId: UnitTranslation.unitId,
      language: UnitTranslation.language,
      sourceUnitId: UnitTranslation.sourceUnitId,
    });
  if (!updated) {
    throw new Error("Translation source was not saved");
  }

  return {
    unitId: updated.unitId,
    language: updated.language as Language,
    sourceUnitId: updated.sourceUnitId,
  };
}

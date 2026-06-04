import type { VariantContextSummary } from "@rezics/contract";
import { readLanguageCandidates } from "@rezics/contract";
import { asc, inArray } from "drizzle-orm";
import { Unit, UnitSupportLanguage, UnitTranslation } from "../db/schema";

type VariantContextCarrier = {
  variantUnitId?: string | null;
};

type VariantTitleRow = {
  id: string;
  supportLanguages: {
    language: string;
    isPrimary: boolean;
    sortOrder: number;
  }[];
  translations: { language: string; title: string | null }[];
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

export async function hydrateVariantContextSummaries<
  T extends VariantContextCarrier,
>(rows: readonly T[]): Promise<Map<string, VariantContextSummary>> {
  const ids = [
    ...new Set(
      rows
        .map((row) => row.variantUnitId?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const summaries = new Map<string, VariantContextSummary>();
  for (const id of ids) summaries.set(id, { unitId: id, title: id });
  if (ids.length === 0) return summaries;

  const db = await getServerDb();
  const [unitRows, supportLanguageRows, translationRows] = await Promise.all([
    db.select({ id: Unit.id }).from(Unit).where(inArray(Unit.id, ids)),
    db
      .select({
        unitId: UnitSupportLanguage.unitId,
        language: UnitSupportLanguage.language,
        isPrimary: UnitSupportLanguage.isPrimary,
        sortOrder: UnitSupportLanguage.sortOrder,
      })
      .from(UnitSupportLanguage)
      .where(inArray(UnitSupportLanguage.unitId, ids))
      .orderBy(
        asc(UnitSupportLanguage.unitId),
        asc(UnitSupportLanguage.sortOrder),
      ),
    db
      .select({
        unitId: UnitTranslation.unitId,
        language: UnitTranslation.language,
        title: UnitTranslation.title,
      })
      .from(UnitTranslation)
      .where(inArray(UnitTranslation.unitId, ids)),
  ]);

  const supportLanguagesByUnitId = new Map<
    string,
    VariantTitleRow["supportLanguages"]
  >();
  for (const row of supportLanguageRows) {
    const items = supportLanguagesByUnitId.get(row.unitId) ?? [];
    items.push({
      language: row.language,
      isPrimary: row.isPrimary,
      sortOrder: row.sortOrder,
    });
    supportLanguagesByUnitId.set(row.unitId, items);
  }

  const translationsByUnitId = new Map<
    string,
    VariantTitleRow["translations"]
  >();
  for (const row of translationRows) {
    const items = translationsByUnitId.get(row.unitId) ?? [];
    items.push({ language: row.language, title: row.title });
    translationsByUnitId.set(row.unitId, items);
  }

  for (const unit of unitRows) {
    const row = {
      id: unit.id,
      supportLanguages: supportLanguagesByUnitId.get(unit.id) ?? [],
      translations: translationsByUnitId.get(unit.id) ?? [],
    };
    summaries.set(unit.id, {
      unitId: unit.id,
      title: pickVariantTitle(row) ?? unit.id,
    });
  }
  return summaries;
}

export function variantContextForRow<T extends VariantContextCarrier>(
  row: T,
  summaries: ReadonlyMap<string, VariantContextSummary> | undefined,
): VariantContextSummary | null {
  const id = row.variantUnitId?.trim();
  if (!id) return null;
  return summaries?.get(id) ?? { unitId: id, title: id };
}

function pickVariantTitle(unit: VariantTitleRow): string | null {
  const byLanguage = new Map(
    unit.translations.map((item) => [item.language, item]),
  );
  const ordered = [
    ...readLanguageCandidates({ supportLanguages: unit.supportLanguages }).map(
      (language) => byLanguage.get(language),
    ),
    unit.translations.find((item) => item.language === "en"),
    ...unit.translations,
  ];
  for (const translation of ordered) {
    const title = translation?.title?.trim();
    if (title) return title;
  }
  return null;
}

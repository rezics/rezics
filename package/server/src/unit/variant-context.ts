import type { VariantContextSummary } from "@rezics/contract";
import { readLanguageCandidates } from "@rezics/contract";
import { prisma } from "#/prisma/client";

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

  const units = await prisma.unit.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      supportLanguages: true,
      translations: {
        select: { language: true, title: true },
      },
    },
  });

  for (const unit of units) {
    summaries.set(unit.id, {
      unitId: unit.id,
      title: pickVariantTitle(unit) ?? unit.id,
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

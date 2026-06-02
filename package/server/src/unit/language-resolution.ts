import type {
  UnitLanguageAvailabilityResponse,
  UnitLanguageContentQuery,
  UnitLanguageContentResponse,
} from "@rezics/contract";
import {
  parseReadLanguages,
  resolveAuthoringLanguage,
  resolveReadLanguage,
} from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma } from "#/prisma/client";
import { mapContentTranslationToDTO } from "@/content-translation/mapper";
import { mapTranslationToDTO } from "./mapper";

export type ActorLanguageSettings = {
  preferredLanguages?: readonly string[] | null;
};

export function resolveUnitAuthoringLanguage(input: {
  explicitLanguage?: string | null;
  actorSettings?: ActorLanguageSettings | null;
  appLocale?: string | null;
}): string {
  return resolveAuthoringLanguage({
    explicitLanguage: input.explicitLanguage,
    preferredLanguages: input.actorSettings?.preferredLanguages,
    appLocale: input.appLocale,
  });
}

export function primarySupportLanguageCreate(language: string) {
  return { language, isPrimary: true, sortOrder: 0 };
}

export async function ensurePrimarySupportLanguage(
  tx: Prisma.TransactionClient,
  unitId: string,
  language: string,
) {
  await tx.unitSupportLanguage.upsert({
    where: { unitId_language: { unitId, language } },
    create: { unitId, ...primarySupportLanguageCreate(language) },
    update: { isPrimary: true, sortOrder: 0 },
  });
}

export class UnitLanguageService {
  async availability(
    unitId: string,
  ): Promise<UnitLanguageAvailabilityResponse> {
    const unit = await prisma.unit.findUniqueOrThrow({
      where: { id: unitId },
      select: {
        id: true,
        supportLanguages: { orderBy: [{ sortOrder: "asc" }] },
        translations: { select: { language: true } },
        contentTranslations: { select: { language: true } },
      },
    });

    return {
      unitId: unit.id,
      supportLanguages: unit.supportLanguages.map((item) => ({
        unitId: item.unitId,
        language: item.language as any,
        isPrimary: item.isPrimary,
        sortOrder: item.sortOrder,
      })),
      unitTranslationLanguages: unit.translations.map(
        (item) => item.language as any,
      ),
      contentTranslationLanguages: unit.contentTranslations.map(
        (item) => item.language as any,
      ),
    };
  }

  async content(
    unitId: string,
    query: UnitLanguageContentQuery = {},
  ): Promise<UnitLanguageContentResponse> {
    const unit = await prisma.unit.findUniqueOrThrow({
      where: { id: unitId },
      include: {
        supportLanguages: { orderBy: [{ sortOrder: "asc" }] },
        translations: true,
        contentTranslations: true,
      },
    });
    const resolvedLanguage = resolveReadLanguage({
      explicitLanguage: query.explicitLanguage,
      languages: parseReadLanguages(
        (query as { languages?: string }).languages,
      ),
      appLocale: query.appLocale,
      supportLanguages: unit.supportLanguages,
    });
    const unitTranslation = resolvedLanguage
      ? unit.translations.find((item) => item.language === resolvedLanguage)
      : undefined;
    const contentTranslation = resolvedLanguage
      ? unit.contentTranslations.find(
          (item) => item.language === resolvedLanguage,
        )
      : undefined;

    return {
      unitId,
      requestedLanguage: query.explicitLanguage,
      resolvedLanguage: resolvedLanguage as any,
      supportLanguages: unit.supportLanguages.map((item) => ({
        unitId: item.unitId,
        language: item.language as any,
        isPrimary: item.isPrimary,
        sortOrder: item.sortOrder,
      })),
      unitTranslation: unitTranslation
        ? mapTranslationToDTO(unitTranslation as any)
        : null,
      contentTranslation: contentTranslation
        ? mapContentTranslationToDTO(contentTranslation)
        : null,
      title: unitTranslation?.title ?? null,
      description: (unitTranslation?.description as any) ?? null,
      // ContentTranslation stores body/content; UnitTranslation stores display
      // metadata such as title and description, so post language reads may
      // intentionally bundle both rows.
      content: (contentTranslation?.content as any) ?? null,
    };
  }
}

export const unitLanguageService = new UnitLanguageService();

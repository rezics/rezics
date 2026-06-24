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
import { asc, eq, sql } from "drizzle-orm";
import { mapContentTranslationToDTO } from "../content-translation/mapper";
import {
  ContentTranslation,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
} from "../db/schema";
import { generateBetween } from "../shelf/fractional-index";
import { notFound } from "../utils/errors";
import { mapTranslationToDTO } from "./mapper";

export type ActorLanguageSettings = {
  preferredLanguages?: readonly string[] | null;
};

export type EffectiveReadLanguageInput = {
  explicitLanguage?: string | null;
  languages?: readonly string[] | null;
  preferredLanguages?: readonly string[] | null;
  appLocale?: string | null;
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

export function primarySupportLanguageCreate(language: string): {
  language: string;
  isPrimary: true;
  position: string;
} {
  return {
    language,
    isPrimary: true,
    position: generateBetween(undefined, undefined),
  };
}

export function resolveEffectiveReadLanguageCandidates(input: {
  languages?: string | readonly string[] | null;
  explicitLanguage?: string | null;
  actorSettings?: ActorLanguageSettings | null;
  appLocale?: string | null;
}): string[] {
  const languages = parseReadLanguages(input.languages);
  return parseReadLanguages(
    [
      input.explicitLanguage,
      input.appLocale,
      ...languages,
      ...(input.actorSettings?.preferredLanguages ?? []),
    ].filter((language): language is string => !!language),
  );
}

export function resolveEffectiveReadLanguageInput(input: {
  languages?: string | readonly string[] | null;
  explicitLanguage?: string | null;
  actorSettings?: ActorLanguageSettings | null;
  appLocale?: string | null;
}): EffectiveReadLanguageInput {
  return {
    explicitLanguage: input.explicitLanguage,
    appLocale: input.appLocale,
    languages: parseReadLanguages(input.languages),
    preferredLanguages: input.actorSettings?.preferredLanguages,
  };
}

export async function ensurePrimarySupportLanguage(
  tx: {
    unitSupportLanguage: {
      upsert(input: {
        where: { unitId_language: { unitId: string; language: string } };
        create: {
          unitId: string;
          language: string;
          isPrimary: true;
          position: string;
        };
        update: { isPrimary: true; position: string };
      }): Promise<unknown>;
    };
  },
  unitId: string,
  language: string,
) {
  await tx.unitSupportLanguage.upsert({
    where: { unitId_language: { unitId, language } },
    create: { unitId, ...primarySupportLanguageCreate(language) },
    update: {
      isPrimary: true,
      position: generateBetween(undefined, undefined),
    },
  });
}

type MissingSupportLanguageRow = {
  unitId: string;
  language: string;
  source: "unit_translation" | "content_translation";
};

type UnitLanguageAvailabilityRow = {
  id: string;
  supportLanguages: Array<typeof UnitSupportLanguage.$inferSelect>;
  translations: Array<Pick<typeof UnitTranslation.$inferSelect, "language">>;
  contentTranslations: Array<
    Pick<typeof ContentTranslation.$inferSelect, "language">
  >;
};

type UnitLanguageContentRow = typeof Unit.$inferSelect & {
  supportLanguages: Array<typeof UnitSupportLanguage.$inferSelect>;
  translations: Array<typeof UnitTranslation.$inferSelect>;
  contentTranslations: Array<typeof ContentTranslation.$inferSelect>;
};

export interface UnitLanguageRepository {
  unitsMissingSupportLanguageRows(
    limit: number,
  ): Promise<MissingSupportLanguageRow[]>;
  getAvailabilityUnit(unitId: string): Promise<UnitLanguageAvailabilityRow>;
  getContentUnit(unitId: string): Promise<UnitLanguageContentRow>;
}

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

async function getUnitOrThrow(unitId: string) {
  const db = await getServerDb();
  const [unit] = await db
    .select()
    .from(Unit)
    .where(eq(Unit.id, unitId))
    .limit(1);
  if (!unit) throw notFound("Unit");
  return unit;
}

function createDrizzleUnitLanguageRepository(): UnitLanguageRepository {
  return {
    async unitsMissingSupportLanguageRows(limit) {
      const db = await getServerDb();
      const result = await db.execute<MissingSupportLanguageRow>(sql`
        SELECT missing."unitId", missing."language", missing."source"
        FROM (
          SELECT ut."unitId", ut."language", 'unit_translation' AS "source"
          FROM "UnitTranslation" ut
          WHERE NOT EXISTS (
            SELECT 1
            FROM "UnitSupportLanguage" usl
            WHERE usl."unitId" = ut."unitId"
              AND usl."language" = ut."language"
          )
          UNION ALL
          SELECT ct."unitId", ct."language", 'content_translation' AS "source"
          FROM "ContentTranslation" ct
          WHERE NOT EXISTS (
            SELECT 1
            FROM "UnitSupportLanguage" usl
            WHERE usl."unitId" = ct."unitId"
              AND usl."language" = ct."language"
          )
        ) missing
        ORDER BY missing."unitId" ASC, missing."language" ASC, missing."source" ASC
        LIMIT ${limit}
      `);
      return result.rows;
    },

    async getAvailabilityUnit(unitId) {
      const db = await getServerDb();
      const unit = await getUnitOrThrow(unitId);
      const [supportLanguages, translations, contentTranslations] =
        await Promise.all([
          db
            .select()
            .from(UnitSupportLanguage)
            .where(eq(UnitSupportLanguage.unitId, unitId))
            .orderBy(
              asc(UnitSupportLanguage.position),
              asc(UnitSupportLanguage.language),
            ),
          db
            .select({ language: UnitTranslation.language })
            .from(UnitTranslation)
            .where(eq(UnitTranslation.unitId, unitId)),
          db
            .select({ language: ContentTranslation.language })
            .from(ContentTranslation)
            .where(eq(ContentTranslation.unitId, unitId)),
        ]);
      return {
        id: unit.id,
        supportLanguages,
        translations,
        contentTranslations,
      };
    },

    async getContentUnit(unitId) {
      const db = await getServerDb();
      const unit = await getUnitOrThrow(unitId);
      const [supportLanguages, translations, contentTranslations] =
        await Promise.all([
          db
            .select()
            .from(UnitSupportLanguage)
            .where(eq(UnitSupportLanguage.unitId, unitId))
            .orderBy(
              asc(UnitSupportLanguage.position),
              asc(UnitSupportLanguage.language),
            ),
          db
            .select()
            .from(UnitTranslation)
            .where(eq(UnitTranslation.unitId, unitId)),
          db
            .select()
            .from(ContentTranslation)
            .where(eq(ContentTranslation.unitId, unitId)),
        ]);
      return { ...unit, supportLanguages, translations, contentTranslations };
    },
  };
}

const defaultRepository = createDrizzleUnitLanguageRepository();

export class UnitLanguageService {
  constructor(
    private readonly repository: UnitLanguageRepository = defaultRepository,
  ) {}

  async unitsMissingSupportLanguageRows(limit = 100): Promise<
    Array<{
      unitId: string;
      language: string;
      source: "unit_translation" | "content_translation";
    }>
  > {
    const take = Math.max(1, Math.min(limit, 500));
    return this.repository.unitsMissingSupportLanguageRows(take);
  }

  async availability(
    unitId: string,
  ): Promise<UnitLanguageAvailabilityResponse> {
    const unit = await this.repository.getAvailabilityUnit(unitId);

    return {
      unitId: unit.id,
      supportLanguages: unit.supportLanguages.map((item) => ({
        unitId: item.unitId,
        language: item.language as any,
        isPrimary: item.isPrimary,
        position: item.position,
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
    const unit = await this.repository.getContentUnit(unitId);
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
        position: item.position,
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
      // ContentTranslation 存储正文/内容；UnitTranslation 存储 title、description
      // 等显示元数据，因此帖子的语言读取可能有意将两行数据合并返回。
      content: (contentTranslation?.content as any) ?? null,
    };
  }
}

export const unitLanguageService = new UnitLanguageService();

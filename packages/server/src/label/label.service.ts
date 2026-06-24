import type { ContentLanguage } from "@rezics/contract";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { unitService } from "@/unit";
import { Unit, UnitTranslation } from "../db/schema";

export type LabelWithTranslations = {
  unitId: string;
  translations: Array<{ language: string; title: string | null }>;
};

export type LabelRepository = {
  getByUnitIds(unitIds: string[]): Promise<LabelWithTranslations[]>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function createDrizzleLabelRepository(): LabelRepository {
  async function hydrate(unitIds: string[]): Promise<LabelWithTranslations[]> {
    if (unitIds.length === 0) return [];
    const db = await getServerDb();
    const rows = await db
      .select({
        unitId: UnitTranslation.unitId,
        language: UnitTranslation.language,
        title: UnitTranslation.title,
      })
      .from(UnitTranslation)
      .where(inArray(UnitTranslation.unitId, unitIds))
      .orderBy(asc(UnitTranslation.language));
    const byUnit = new Map<string, LabelWithTranslations>();
    for (const id of unitIds) byUnit.set(id, { unitId: id, translations: [] });
    for (const row of rows) {
      byUnit
        .get(row.unitId)
        ?.translations.push({ language: row.language, title: row.title });
    }
    return [...byUnit.values()];
  }

  return {
    async getByUnitIds(unitIds) {
      if (unitIds.length === 0) return [];
      const db = await getServerDb();
      const rows = await db
        .select({ unitId: Unit.id })
        .from(Unit)
        .where(
          and(
            inArray(Unit.id, unitIds),
            eq(Unit.type, "LABEL"),
            ne(Unit.status, "DELETED"),
          ),
        );
      return hydrate(rows.map((row) => row.unitId));
    },
  };
}

/**
 * Curated short labels (LABEL units) back every translated string in zone
 * configs (section titles, menu labels). Search is served by the dedicated
 * Meili `labels` index; this service owns create and id hydration.
 * 精选短标签（LABEL Unit）支撑专区配置中的所有可翻译字符串（分区标题、
 * 菜单标签）。搜索由专用 Meili `labels` 索引提供；本服务负责创建与按 id 水合。
 */
export class LabelService {
  constructor(
    private readonly repository: LabelRepository = createDrizzleLabelRepository(),
  ) {}

  async getByUnitIds(unitIds: string[]): Promise<LabelWithTranslations[]> {
    return this.repository.getByUnitIds(unitIds);
  }

  async create(input: {
    userId: string;
    translations: Array<{ language: ContentLanguage; title: string }>;
  }): Promise<LabelWithTranslations> {
    const unit = await unitService.create({
      userId: input.userId,
      type: "LABEL",
      status: "PUBLISHED",
      translations: input.translations.map((tr) => ({
        language: tr.language,
        title: tr.title,
      })),
    });
    return {
      unitId: unit.id,
      translations: input.translations.map((tr) => ({
        language: tr.language,
        title: tr.title,
      })),
    };
  }
}

export const labelService = new LabelService();

import type {
  CreateSourceSiteInput,
  SourceSiteListQuery,
  SourceSiteRefRule,
  UpdateSourceSiteInput,
} from "@rezics/contract";
import { isValidSourceRefRules } from "@rezics/contract";
import { and, count, eq, ilike, inArray, or, type SQL, sql } from "drizzle-orm";
import { Entity, SourceSite, Unit, UnitTranslation } from "../db/schema";
import { AppError } from "../utils/errors";
import type { SourceSiteWithRelations } from "./source-site.types";

const SOURCE_SITE_DISPLAY_FIELDS = [
  "name",
  "logo",
  "description",
  "summary",
  "translations",
  "slug",
  "homepageUrl",
] as const;

type SourceSiteRow = typeof SourceSite.$inferSelect;
type SourceSiteCreateData = Omit<
  typeof SourceSite.$inferInsert,
  "updatedAt" | "refRules"
> & {
  refRules: unknown;
};
type SourceSiteUpdateData = Partial<
  Pick<
    SourceSiteRow,
    "key" | "crawlSupport" | "crawlEnabled" | "crawlerAdapterKey" | "refRules"
  >
>;

export type SourceSiteRepository = {
  list(input: {
    query: SourceSiteListQuery;
    offset: number;
    limit: number;
  }): Promise<{ rows: SourceSiteWithRelations[]; total: number }>;
  getByEntityUnitId(
    entityUnitId: string,
  ): Promise<SourceSiteWithRelations | undefined>;
  entityExists(unitId: string): Promise<boolean>;
  create(data: SourceSiteCreateData): Promise<SourceSiteWithRelations>;
  update(
    entityUnitId: string,
    data: SourceSiteUpdateData,
  ): Promise<SourceSiteWithRelations>;
  delete(entityUnitId: string): Promise<void>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function assertNoDisplayFields(input: Record<string, unknown>) {
  const duplicatedField = SOURCE_SITE_DISPLAY_FIELDS.find((field) =>
    Object.hasOwn(input, field),
  );
  if (duplicatedField) {
    throw new AppError(400, "SourceSite cannot write Entity display fields", {
      code: "source_site_display_field_rejected",
      details: { field: duplicatedField },
    });
  }
}

function assertValidRefRules(refRules: readonly SourceSiteRefRule[]) {
  if (!isValidSourceRefRules(refRules)) {
    throw new AppError(400, "Invalid SourceSite reference rules", {
      code: "source_site_ref_rules_invalid",
    });
  }
}

function buildSourceSiteConditions(query: SourceSiteListQuery): SQL[] {
  const conditions: SQL[] = [];
  if (query.key) {
    conditions.push(eq(SourceSite.key, query.key));
  }
  if (query.crawlSupport) {
    conditions.push(eq(SourceSite.crawlSupport, query.crawlSupport));
  }
  if (query.crawlEnabled !== undefined) {
    conditions.push(eq(SourceSite.crawlEnabled, query.crawlEnabled));
  }

  const q = query.q?.trim();
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        ilike(SourceSite.key, pattern),
        sql`exists (
          select 1
          from ${UnitTranslation}
          where ${UnitTranslation.unitId} = ${SourceSite.entityUnitId}
            and ${UnitTranslation.title} ilike ${pattern}
        )`,
      )!,
    );
  }

  return conditions;
}

function createDrizzleSourceSiteRepository(): SourceSiteRepository {
  async function hydrate(
    rows: SourceSiteRow[],
  ): Promise<SourceSiteWithRelations[]> {
    if (rows.length === 0) {
      return [];
    }

    const db = await getServerDb();
    const entityUnitIds = rows.map((row) => row.entityUnitId);
    const [entityRows, translationRows] = await Promise.all([
      db
        .select({ entity: Entity, unit: Unit })
        .from(Entity)
        .innerJoin(Unit, eq(Entity.unitId, Unit.id))
        .where(inArray(Entity.unitId, entityUnitIds)),
      db
        .select()
        .from(UnitTranslation)
        .where(inArray(UnitTranslation.unitId, entityUnitIds)),
    ]);

    const translationsByUnit = new Map<string, typeof translationRows>();
    for (const translation of translationRows) {
      const list = translationsByUnit.get(translation.unitId) ?? [];
      list.push(translation);
      translationsByUnit.set(translation.unitId, list);
    }

    const entitiesByUnit = new Map<string, unknown>();
    for (const row of entityRows) {
      entitiesByUnit.set(row.entity.unitId, {
        ...row.entity,
        unit: {
          ...row.unit,
          translations: translationsByUnit.get(row.entity.unitId) ?? [],
        },
      });
    }

    return rows.map((row) => ({
      ...row,
      entity: entitiesByUnit.get(row.entityUnitId) ?? null,
    }));
  }

  async function getByEntityUnitId(
    entityUnitId: string,
  ): Promise<SourceSiteWithRelations | undefined> {
    const db = await getServerDb();
    const [row] = await db
      .select()
      .from(SourceSite)
      .where(eq(SourceSite.entityUnitId, entityUnitId))
      .limit(1);
    if (!row) {
      return undefined;
    }
    return (await hydrate([row]))[0];
  }

  return {
    async list({ query, offset, limit }) {
      const db = await getServerDb();
      const conditions = buildSourceSiteConditions(query);
      const where = conditions.length ? and(...conditions) : undefined;
      const [rows, totalRows] = await Promise.all([
        db
          .select()
          .from(SourceSite)
          .where(where)
          .orderBy(SourceSite.key)
          .offset(offset)
          .limit(limit),
        db.select({ total: count() }).from(SourceSite).where(where),
      ]);

      return {
        rows: await hydrate(rows),
        total: totalRows[0]?.total ?? 0,
      };
    },

    getByEntityUnitId,

    async entityExists(unitId) {
      const db = await getServerDb();
      const [row] = await db
        .select({ unitId: Entity.unitId })
        .from(Entity)
        .where(eq(Entity.unitId, unitId))
        .limit(1);
      return Boolean(row);
    },

    async create(data) {
      const db = await getServerDb();
      const [row] = await db
        .insert(SourceSite)
        .values({
          ...data,
          updatedAt: new Date(),
        })
        .returning({ entityUnitId: SourceSite.entityUnitId });
      if (!row) {
        throw new AppError(500, "SourceSite was not created", {
          code: "source_site_create_failed",
        });
      }
      const created = await getByEntityUnitId(row.entityUnitId);
      if (!created) {
        throw new AppError(500, "SourceSite was not loaded", {
          code: "source_site_load_failed",
        });
      }
      return created;
    },

    async update(entityUnitId, data) {
      const db = await getServerDb();
      const [row] = await db
        .update(SourceSite)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(SourceSite.entityUnitId, entityUnitId))
        .returning({ entityUnitId: SourceSite.entityUnitId });
      if (!row) {
        throw new AppError(404, "SourceSite not found", {
          code: "source_site_not_found",
          details: { entityUnitId },
        });
      }
      const updated = await getByEntityUnitId(row.entityUnitId);
      if (!updated) {
        throw new AppError(500, "SourceSite was not loaded", {
          code: "source_site_load_failed",
        });
      }
      return updated;
    },

    async delete(entityUnitId) {
      const db = await getServerDb();
      await db
        .delete(SourceSite)
        .where(eq(SourceSite.entityUnitId, entityUnitId));
    },
  };
}

export class SourceSiteService {
  constructor(
    private readonly repository = createDrizzleSourceSiteRepository(),
  ) {}

  async list(query: SourceSiteListQuery = {}) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const limit = Math.max(1, Math.min(Number(query.limit ?? 50), 100));
    const offset = (page - 1) * limit;

    return this.repository.list({ query, offset, limit });
  }

  async getByEntityUnitId(entityUnitId: string) {
    return this.repository.getByEntityUnitId(entityUnitId);
  }

  async create(input: CreateSourceSiteInput) {
    assertNoDisplayFields(input as Record<string, unknown>);
    assertValidRefRules(input.refRules);

    if (!(await this.repository.entityExists(input.entityUnitId))) {
      throw new AppError(404, "Entity not found", {
        code: "entity_not_found",
        details: { unitId: input.entityUnitId },
      });
    }

    return this.repository.create({
      entityUnitId: input.entityUnitId,
      key: input.key,
      crawlSupport: input.crawlSupport,
      crawlEnabled: input.crawlEnabled ?? false,
      crawlerAdapterKey: input.crawlerAdapterKey ?? null,
      refRules: input.refRules,
    });
  }

  async update(entityUnitId: string, input: UpdateSourceSiteInput) {
    assertNoDisplayFields(input as Record<string, unknown>);
    if (input.refRules) {
      assertValidRefRules(input.refRules);
    }

    return this.repository.update(entityUnitId, {
      key: input.key,
      crawlSupport: input.crawlSupport,
      crawlEnabled: input.crawlEnabled,
      crawlerAdapterKey:
        input.crawlerAdapterKey !== undefined
          ? input.crawlerAdapterKey
          : undefined,
      refRules: input.refRules,
    });
  }

  async delete(entityUnitId: string) {
    await this.repository.delete(entityUnitId);
  }
}

export const sourceSiteService = new SourceSiteService();

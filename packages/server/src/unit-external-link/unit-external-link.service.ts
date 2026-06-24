import { createHash } from "node:crypto";
import type {
  CreateUnitExternalLinkInput,
  UnitExternalLinkDTO,
  UnitExternalLinkListQuery,
  UpdateUnitExternalLinkInput,
} from "@rezics/contract";
import { and, asc, count, desc, eq, inArray, type SQL } from "drizzle-orm";
import { Entity, Unit, UnitExternalLink, UnitTranslation } from "../db/schema";
import { generateBetween } from "../shelf/fractional-index";
import { AppError } from "../utils/errors";
import type {
  HydratedExternalLinkEntity,
  HydratedExternalLinkUnit,
  UnitExternalLinkWithRelations,
} from "./unit-external-link.types";

type UnitExternalLinkRow = typeof UnitExternalLink.$inferSelect;
type UnitExternalLinkCreateData = Omit<
  typeof UnitExternalLink.$inferInsert,
  "id" | "updatedAt"
>;
type UnitExternalLinkUpdateData = Partial<
  Pick<
    UnitExternalLinkRow,
    | "sourceEntityUnitId"
    | "url"
    | "normalizedUrl"
    | "normalizedUrlHash"
    | "role"
    | "labelUnitId"
    | "fallbackText"
    | "position"
  >
>;

export type UnitExternalLinkRepository = {
  list(input: {
    query: UnitExternalLinkListQuery;
    offset: number;
    limit: number;
  }): Promise<{ rows: UnitExternalLinkWithRelations[]; total: number }>;
  unitExists(unitId: string): Promise<boolean>;
  entityExists(unitId: string): Promise<boolean>;
  nextPosition(unitId: string): Promise<string>;
  create(
    data: UnitExternalLinkCreateData,
  ): Promise<UnitExternalLinkWithRelations>;
  getById(id: string): Promise<UnitExternalLinkWithRelations | undefined>;
  getCurrent(
    id: string,
  ): Promise<
    Pick<UnitExternalLinkRow, "sourceEntityUnitId" | "url"> | undefined
  >;
  update(
    id: string,
    data: UnitExternalLinkUpdateData,
  ): Promise<UnitExternalLinkWithRelations>;
  delete(id: string): Promise<void>;
  listExternalLinksForUnits(
    unitIds: readonly string[],
  ): Promise<UnitExternalLinkWithRelations[]>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function normalizeExternalUrl(url: string): {
  url: string;
  hash: string;
} {
  const parsed = new URL(url);
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = "";
  parsed.searchParams.sort();
  const normalized = parsed.toString();
  return {
    url: normalized,
    hash: createHash("sha256").update(normalized).digest("hex"),
  };
}

function buildConditions(query: UnitExternalLinkListQuery): SQL[] {
  const conditions: SQL[] = [];
  if (query.unitId) conditions.push(eq(UnitExternalLink.unitId, query.unitId));
  if (query.sourceEntityUnitId) {
    conditions.push(
      eq(UnitExternalLink.sourceEntityUnitId, query.sourceEntityUnitId),
    );
  }
  if (query.role) conditions.push(eq(UnitExternalLink.role, query.role));
  return conditions;
}

function createDrizzleUnitExternalLinkRepository(): UnitExternalLinkRepository {
  async function hydrate(
    rows: UnitExternalLinkRow[],
  ): Promise<UnitExternalLinkWithRelations[]> {
    if (rows.length === 0) return [];
    const sourceEntityUnitIds = [
      ...new Set(rows.map((row) => row.sourceEntityUnitId)),
    ];
    const labelUnitIds = [
      ...new Set(
        rows
          .map((row) => row.labelUnitId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const translationUnitIds = [
      ...new Set([...sourceEntityUnitIds, ...labelUnitIds]),
    ];

    const db = await getServerDb();
    const [entityRows, labelUnitRows, translationRows] = await Promise.all([
      db
        .select({ entity: Entity, unit: Unit })
        .from(Entity)
        .innerJoin(Unit, eq(Entity.unitId, Unit.id))
        .where(inArray(Entity.unitId, sourceEntityUnitIds)),
      labelUnitIds.length
        ? db.select().from(Unit).where(inArray(Unit.id, labelUnitIds))
        : Promise.resolve([]),
      db
        .select()
        .from(UnitTranslation)
        .where(inArray(UnitTranslation.unitId, translationUnitIds)),
    ]);

    const translationsByUnit = new Map<string, typeof translationRows>();
    for (const translation of translationRows) {
      const list = translationsByUnit.get(translation.unitId) ?? [];
      list.push(translation);
      translationsByUnit.set(translation.unitId, list);
    }

    const entitiesByUnit = new Map<string, HydratedExternalLinkEntity>();
    for (const row of entityRows) {
      entitiesByUnit.set(row.entity.unitId, {
        ...row.entity,
        unit: {
          ...row.unit,
          translations: translationsByUnit.get(row.entity.unitId) ?? [],
        },
      });
    }

    const unitsById = new Map<string, HydratedExternalLinkUnit>();
    for (const unit of labelUnitRows) {
      unitsById.set(unit.id, {
        ...unit,
        translations: translationsByUnit.get(unit.id) ?? [],
      });
    }

    return rows.map((row) => ({
      ...row,
      sourceEntity: entitiesByUnit.get(row.sourceEntityUnitId) ?? null,
      labelUnit: row.labelUnitId
        ? (unitsById.get(row.labelUnitId) ?? null)
        : null,
    }));
  }

  async function getById(
    id: string,
  ): Promise<UnitExternalLinkWithRelations | undefined> {
    const db = await getServerDb();
    const [row] = await db
      .select()
      .from(UnitExternalLink)
      .where(eq(UnitExternalLink.id, id))
      .limit(1);
    return row ? (await hydrate([row]))[0] : undefined;
  }

  return {
    async list({ query, offset, limit }) {
      const db = await getServerDb();
      const conditions = buildConditions(query);
      const where = conditions.length ? and(...conditions) : undefined;
      const [rows, totalRows] = await Promise.all([
        db
          .select()
          .from(UnitExternalLink)
          .where(where)
          .orderBy(asc(UnitExternalLink.position), asc(UnitExternalLink.id))
          .offset(offset)
          .limit(limit),
        db.select({ total: count() }).from(UnitExternalLink).where(where),
      ]);
      return {
        rows: await hydrate(rows),
        total: totalRows[0]?.total ?? 0,
      };
    },

    async unitExists(unitId) {
      const db = await getServerDb();
      const [row] = await db
        .select({ id: Unit.id })
        .from(Unit)
        .where(eq(Unit.id, unitId))
        .limit(1);
      return Boolean(row);
    },

    async nextPosition(unitId) {
      const db = await getServerDb();
      const [last] = await db
        .select({ position: UnitExternalLink.position })
        .from(UnitExternalLink)
        .where(eq(UnitExternalLink.unitId, unitId))
        .orderBy(desc(UnitExternalLink.position), desc(UnitExternalLink.id))
        .limit(1);
      return generateBetween(last?.position, undefined);
    },

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
        .insert(UnitExternalLink)
        .values({ ...data, updatedAt: new Date() })
        .returning({ id: UnitExternalLink.id });
      if (!row) {
        throw new AppError(500, "UnitExternalLink was not created", {
          code: "unit_external_link_create_failed",
        });
      }
      const created = await getById(row.id);
      if (!created) {
        throw new AppError(500, "UnitExternalLink was not loaded", {
          code: "unit_external_link_load_failed",
        });
      }
      return created;
    },

    getById,

    async getCurrent(id) {
      const db = await getServerDb();
      const [row] = await db
        .select({
          sourceEntityUnitId: UnitExternalLink.sourceEntityUnitId,
          url: UnitExternalLink.url,
        })
        .from(UnitExternalLink)
        .where(eq(UnitExternalLink.id, id))
        .limit(1);
      return row;
    },

    async update(id, data) {
      const db = await getServerDb();
      const [row] = await db
        .update(UnitExternalLink)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(UnitExternalLink.id, id))
        .returning({ id: UnitExternalLink.id });
      if (!row) {
        throw new AppError(404, "UnitExternalLink not found", {
          code: "unit_external_link_not_found",
          details: { id },
        });
      }
      const updated = await getById(row.id);
      if (!updated) {
        throw new AppError(500, "UnitExternalLink was not loaded", {
          code: "unit_external_link_load_failed",
        });
      }
      return updated;
    },

    async delete(id) {
      const db = await getServerDb();
      await db.delete(UnitExternalLink).where(eq(UnitExternalLink.id, id));
    },

    async listExternalLinksForUnits(unitIds) {
      if (unitIds.length === 0) return [];
      const db = await getServerDb();
      const rows = await db
        .select()
        .from(UnitExternalLink)
        .where(inArray(UnitExternalLink.unitId, [...unitIds]))
        .orderBy(asc(UnitExternalLink.position), asc(UnitExternalLink.id));
      return hydrate(rows);
    },
  };
}

export class UnitExternalLinkService {
  constructor(
    private readonly repository = createDrizzleUnitExternalLinkRepository(),
  ) {}

  async list(query: UnitExternalLinkListQuery = {}) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const limit = Math.max(1, Math.min(Number(query.limit ?? 50), 100));
    const offset = (page - 1) * limit;
    return this.repository.list({ query, offset, limit });
  }

  async create(input: CreateUnitExternalLinkInput) {
    await this.assertUnitAndSource(input.unitId, input.sourceEntityUnitId);
    const normalized = normalizeExternalUrl(input.url);
    // The catalog server intentionally keeps URL handling generic. Source
    // Entity + full URL is the crawler contract; platform-specific parsing
    // belongs to crawler/ingestion code, not this schema boundary.
    return this.repository.create({
      unitId: input.unitId,
      sourceEntityUnitId: input.sourceEntityUnitId,
      url: input.url,
      normalizedUrl: normalized.url,
      normalizedUrlHash: normalized.hash,
      role: input.role ?? "related",
      labelUnitId: input.labelUnitId ?? null,
      fallbackText: input.fallbackText ?? null,
      position:
        input.position ?? (await this.repository.nextPosition(input.unitId)),
    });
  }

  async update(id: string, input: UpdateUnitExternalLinkInput) {
    const current = await this.repository.getCurrent(id);
    if (!current) {
      throw new AppError(404, "UnitExternalLink not found", {
        code: "unit_external_link_not_found",
        details: { id },
      });
    }
    if (
      input.sourceEntityUnitId &&
      !(await this.repository.entityExists(input.sourceEntityUnitId))
    ) {
      throw new AppError(404, "Source Entity not found", {
        code: "unit_external_link_source_entity_not_found",
        details: { unitId: input.sourceEntityUnitId },
      });
    }
    const normalized = input.url ? normalizeExternalUrl(input.url) : undefined;
    return this.repository.update(id, {
      sourceEntityUnitId: input.sourceEntityUnitId,
      url: input.url,
      normalizedUrl: normalized?.url,
      normalizedUrlHash: normalized?.hash,
      role: input.role,
      labelUnitId:
        input.labelUnitId !== undefined ? input.labelUnitId : undefined,
      fallbackText:
        input.fallbackText !== undefined ? input.fallbackText : undefined,
      position: input.position,
    });
  }

  async delete(id: string) {
    await this.repository.delete(id);
  }

  async externalLinksForUnit(unitId: string, sourceEntityUnitId?: string) {
    const batch = await this.externalLinksForUnits([unitId]);
    const response = batch.byUnitId[unitId] ?? { unitId, links: [] };
    return sourceEntityUnitId
      ? {
          unitId,
          links: response.links.filter(
            (link) => link.sourceEntityUnitId === sourceEntityUnitId,
          ),
        }
      : response;
  }

  async externalLinksForUnits(unitIds: readonly string[]) {
    const links = await this.repository.listExternalLinksForUnits(unitIds);
    const byUnitId: Record<
      string,
      { unitId: string; links: UnitExternalLinkDTO[] }
    > = Object.fromEntries(
      unitIds.map((unitId) => [unitId, { unitId, links: [] }]),
    );
    const { mapUnitExternalLinkToDTO } = await import(
      "./unit-external-link.mapper"
    );
    for (const link of links) {
      byUnitId[link.unitId] ??= { unitId: link.unitId, links: [] };
      byUnitId[link.unitId]!.links.push(mapUnitExternalLinkToDTO(link));
    }
    return { byUnitId };
  }

  private async assertUnitAndSource(
    unitId: string,
    sourceEntityUnitId: string,
  ) {
    if (!(await this.repository.unitExists(unitId))) {
      throw new AppError(404, "Unit not found", {
        code: "unit_not_found",
        details: { id: unitId },
      });
    }
    if (!(await this.repository.entityExists(sourceEntityUnitId))) {
      throw new AppError(404, "Source Entity not found", {
        code: "unit_external_link_source_entity_not_found",
        details: { unitId: sourceEntityUnitId },
      });
    }
  }
}

export const unitExternalLinkService = new UnitExternalLinkService();

import type {
  CreateUnitExternalRefInput,
  ExternalKind,
  UnitExternalRefListQuery,
  UpdateUnitExternalRefInput,
} from "@rezics/contract";
import {
  buildCanonicalUrl,
  parseSourceUrl,
  type SourceSiteRefRule,
} from "@rezics/contract";
import { and, count, desc, eq, inArray, type SQL } from "drizzle-orm";
import {
  Entity,
  SourceSite,
  Unit,
  UnitExternalRef,
  UnitTranslation,
} from "../db/schema";
import { AppError } from "../utils/errors";
import type { UnitExternalRefWithRelations } from "./unit-external-ref.types";

type RefIdentity = {
  externalKind: ExternalKind;
  externalId: string;
  canonicalUrl: string;
  originalUrl?: string | null;
};

type SourceSiteRulesRow = {
  refRules: unknown;
};

type UnitExternalRefRow = typeof UnitExternalRef.$inferSelect;

type UnitExternalRefCreateData = {
  unitId: string;
  sourceSiteEntityUnitId: string;
  externalKind: ExternalKind;
  externalId: string;
  canonicalUrl: string;
  originalUrl: string | null;
  firstSeenAt?: Date;
  lastSeenAt?: Date;
};

type UnitExternalRefUpdateData = {
  externalKind?: ExternalKind;
  externalId?: string;
  canonicalUrl?: string;
  originalUrl?: string | null;
  firstSeenAt?: Date;
  lastSeenAt?: Date;
};

export type UnitExternalRefRepository = {
  list(input: {
    query: UnitExternalRefListQuery;
    offset: number;
    limit: number;
  }): Promise<{ rows: UnitExternalRefWithRelations[]; total: number }>;
  unitExists(unitId: string): Promise<boolean>;
  getSourceSiteRules(
    entityUnitId: string,
  ): Promise<SourceSiteRulesRow | undefined>;
  create(
    data: UnitExternalRefCreateData,
  ): Promise<UnitExternalRefWithRelations>;
  getCurrent(
    id: string,
  ): Promise<
    | Pick<
        UnitExternalRefRow,
        "sourceSiteEntityUnitId" | "externalKind" | "externalId" | "originalUrl"
      >
    | undefined
  >;
  update(
    id: string,
    data: UnitExternalRefUpdateData,
  ): Promise<UnitExternalRefWithRelations>;
  delete(id: string): Promise<void>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function sourceSiteRules(sourceSite: SourceSiteRulesRow): SourceSiteRefRule[] {
  return sourceSite.refRules as SourceSiteRefRule[];
}

function deriveIdentity(
  input: Pick<
    CreateUnitExternalRefInput | UpdateUnitExternalRefInput,
    "externalKind" | "externalId" | "observedUrl" | "originalUrl"
  >,
  refRules: readonly SourceSiteRefRule[],
): RefIdentity {
  if (input.observedUrl && (!input.externalKind || !input.externalId)) {
    const parsed = parseSourceUrl(input.observedUrl, refRules);
    if (!parsed) {
      throw new AppError(400, "Source URL does not match SourceSite rules", {
        code: "unit_external_ref_url_unmatched",
      });
    }

    return {
      externalKind: parsed.externalKind,
      externalId: parsed.externalId,
      canonicalUrl: buildCanonicalUrl(
        parsed.rule.urlTemplate,
        parsed.externalId,
      ),
      originalUrl: input.originalUrl ?? input.observedUrl,
    };
  }

  if (!input.externalKind || !input.externalId) {
    throw new AppError(
      400,
      "UnitExternalRef requires externalKind/externalId or observedUrl",
      { code: "unit_external_ref_identity_required" },
    );
  }

  const rule = refRules.find(
    (candidate) => candidate.externalKind === input.externalKind,
  );
  if (!rule) {
    throw new AppError(400, "External kind is not declared by SourceSite", {
      code: "unit_external_ref_kind_not_declared",
      details: { externalKind: input.externalKind },
    });
  }

  return {
    externalKind: input.externalKind,
    externalId: input.externalId,
    canonicalUrl: buildCanonicalUrl(rule.urlTemplate, input.externalId),
    originalUrl: input.originalUrl ?? input.observedUrl ?? null,
  };
}

function buildUnitExternalRefConditions(
  query: UnitExternalRefListQuery,
): SQL[] {
  const conditions: SQL[] = [];

  if (query.unitId) {
    conditions.push(eq(UnitExternalRef.unitId, query.unitId));
  }
  if (query.sourceSiteEntityUnitId) {
    conditions.push(
      eq(UnitExternalRef.sourceSiteEntityUnitId, query.sourceSiteEntityUnitId),
    );
  }
  if (query.externalKind) {
    conditions.push(eq(UnitExternalRef.externalKind, query.externalKind));
  }
  if (query.externalId) {
    conditions.push(eq(UnitExternalRef.externalId, query.externalId));
  }

  return conditions;
}

function withSourceSite(row: {
  ref: UnitExternalRefRow;
  sourceSite: typeof SourceSite.$inferSelect | null;
}): UnitExternalRefWithRelations {
  return {
    ...row.ref,
    sourceSite: row.sourceSite,
  };
}

function createDrizzleUnitExternalRefRepository(): UnitExternalRefRepository {
  async function hydrateSourceSites(
    rows: UnitExternalRefWithRelations[],
  ): Promise<UnitExternalRefWithRelations[]> {
    const sourceSiteIds = [
      ...new Set(
        rows
          .map((row) => row.sourceSite?.entityUnitId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (sourceSiteIds.length === 0) {
      return rows;
    }

    const db = await getServerDb();
    const [entityRows, translationRows] = await Promise.all([
      db
        .select({ entity: Entity, unit: Unit })
        .from(Entity)
        .innerJoin(Unit, eq(Entity.unitId, Unit.id))
        .where(inArray(Entity.unitId, sourceSiteIds)),
      db
        .select()
        .from(UnitTranslation)
        .where(inArray(UnitTranslation.unitId, sourceSiteIds)),
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
      sourceSite: row.sourceSite
        ? {
            ...row.sourceSite,
            entity: entitiesByUnit.get(row.sourceSite.entityUnitId) ?? null,
          }
        : row.sourceSite,
    }));
  }

  async function getById(
    id: string,
  ): Promise<UnitExternalRefWithRelations | undefined> {
    const db = await getServerDb();
    const [row] = await db
      .select({ ref: UnitExternalRef, sourceSite: SourceSite })
      .from(UnitExternalRef)
      .leftJoin(
        SourceSite,
        eq(UnitExternalRef.sourceSiteEntityUnitId, SourceSite.entityUnitId),
      )
      .where(eq(UnitExternalRef.id, id))
      .limit(1);

    return row
      ? (await hydrateSourceSites([withSourceSite(row)]))[0]
      : undefined;
  }

  return {
    async list({ query, offset, limit }) {
      const db = await getServerDb();
      const conditions = buildUnitExternalRefConditions(query);
      const where = conditions.length ? and(...conditions) : undefined;
      const [rows, totalRows] = await Promise.all([
        db
          .select({ ref: UnitExternalRef, sourceSite: SourceSite })
          .from(UnitExternalRef)
          .leftJoin(
            SourceSite,
            eq(UnitExternalRef.sourceSiteEntityUnitId, SourceSite.entityUnitId),
          )
          .where(where)
          .orderBy(desc(UnitExternalRef.lastSeenAt))
          .offset(offset)
          .limit(limit),
        db.select({ total: count() }).from(UnitExternalRef).where(where),
      ]);

      return {
        rows: await hydrateSourceSites(rows.map(withSourceSite)),
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

    async getSourceSiteRules(entityUnitId) {
      const db = await getServerDb();
      const [row] = await db
        .select({ refRules: SourceSite.refRules })
        .from(SourceSite)
        .where(eq(SourceSite.entityUnitId, entityUnitId))
        .limit(1);
      return row;
    },

    async create(data) {
      const db = await getServerDb();
      const [row] = await db
        .insert(UnitExternalRef)
        .values({
          ...data,
          updatedAt: new Date(),
        })
        .returning({ id: UnitExternalRef.id });
      if (!row) {
        throw new AppError(500, "UnitExternalRef was not created", {
          code: "unit_external_ref_create_failed",
        });
      }
      const created = await getById(row.id);
      if (!created) {
        throw new AppError(500, "UnitExternalRef was not loaded", {
          code: "unit_external_ref_load_failed",
        });
      }
      return created;
    },

    async getCurrent(id) {
      const db = await getServerDb();
      const [row] = await db
        .select({
          sourceSiteEntityUnitId: UnitExternalRef.sourceSiteEntityUnitId,
          externalKind: UnitExternalRef.externalKind,
          externalId: UnitExternalRef.externalId,
          originalUrl: UnitExternalRef.originalUrl,
        })
        .from(UnitExternalRef)
        .where(eq(UnitExternalRef.id, id))
        .limit(1);
      return row;
    },

    async update(id, data) {
      const db = await getServerDb();
      const [row] = await db
        .update(UnitExternalRef)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(UnitExternalRef.id, id))
        .returning({ id: UnitExternalRef.id });
      if (!row) {
        throw new AppError(404, "UnitExternalRef not found", {
          code: "unit_external_ref_not_found",
          details: { id },
        });
      }
      const updated = await getById(row.id);
      if (!updated) {
        throw new AppError(500, "UnitExternalRef was not loaded", {
          code: "unit_external_ref_load_failed",
        });
      }
      return updated;
    },

    async delete(id) {
      const db = await getServerDb();
      await db.delete(UnitExternalRef).where(eq(UnitExternalRef.id, id));
    },
  };
}

export class UnitExternalRefService {
  constructor(
    private readonly repository = createDrizzleUnitExternalRefRepository(),
  ) {}

  async list(query: UnitExternalRefListQuery = {}) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const limit = Math.max(1, Math.min(Number(query.limit ?? 50), 100));
    const offset = (page - 1) * limit;

    return this.repository.list({ query, offset, limit });
  }

  async create(input: CreateUnitExternalRefInput) {
    if (!(await this.repository.unitExists(input.unitId))) {
      throw new AppError(404, "Unit not found", {
        code: "unit_not_found",
        details: { id: input.unitId },
      });
    }
    const sourceSite = await this.repository.getSourceSiteRules(
      input.sourceSiteEntityUnitId,
    );
    if (!sourceSite) {
      throw new AppError(404, "SourceSite not found", {
        code: "source_site_not_found",
        details: { entityUnitId: input.sourceSiteEntityUnitId },
      });
    }
    const identity = deriveIdentity(input, sourceSiteRules(sourceSite));

    return this.repository.create({
      unitId: input.unitId,
      sourceSiteEntityUnitId: input.sourceSiteEntityUnitId,
      externalKind: identity.externalKind,
      externalId: identity.externalId,
      canonicalUrl: identity.canonicalUrl,
      originalUrl: identity.originalUrl ?? null,
      firstSeenAt: input.firstSeenAt ? new Date(input.firstSeenAt) : undefined,
      lastSeenAt: input.lastSeenAt ? new Date(input.lastSeenAt) : undefined,
    });
  }

  async update(id: string, input: UpdateUnitExternalRefInput) {
    const current = await this.repository.getCurrent(id);
    if (!current) {
      throw new AppError(404, "UnitExternalRef not found", {
        code: "unit_external_ref_not_found",
        details: { id },
      });
    }
    const sourceSite = await this.repository.getSourceSiteRules(
      current.sourceSiteEntityUnitId,
    );
    if (!sourceSite) {
      throw new AppError(404, "SourceSite not found", {
        code: "source_site_not_found",
        details: { entityUnitId: current.sourceSiteEntityUnitId },
      });
    }
    const identity =
      input.externalKind !== undefined ||
      input.externalId !== undefined ||
      input.observedUrl !== undefined
        ? deriveIdentity(
            {
              externalKind:
                input.externalKind ?? (current.externalKind as ExternalKind),
              externalId: input.externalId ?? current.externalId,
              observedUrl: input.observedUrl,
              originalUrl: input.originalUrl ?? current.originalUrl,
            },
            sourceSiteRules(sourceSite),
          )
        : undefined;

    return this.repository.update(id, {
      externalKind: identity?.externalKind,
      externalId: identity?.externalId,
      canonicalUrl: identity?.canonicalUrl,
      originalUrl:
        input.originalUrl !== undefined
          ? input.originalUrl
          : identity?.originalUrl,
      firstSeenAt: input.firstSeenAt ? new Date(input.firstSeenAt) : undefined,
      lastSeenAt: input.lastSeenAt ? new Date(input.lastSeenAt) : undefined,
    });
  }

  async delete(id: string) {
    await this.repository.delete(id);
  }

  async parseUrl(sourceSiteEntityUnitId: string, url: string) {
    const sourceSite = await this.repository.getSourceSiteRules(
      sourceSiteEntityUnitId,
    );
    if (!sourceSite) {
      throw new AppError(404, "SourceSite not found", {
        code: "source_site_not_found",
        details: { entityUnitId: sourceSiteEntityUnitId },
      });
    }
    const parsed = parseSourceUrl(url, sourceSiteRules(sourceSite));
    if (!parsed) {
      throw new AppError(400, "Source URL does not match SourceSite rules", {
        code: "unit_external_ref_url_unmatched",
      });
    }
    return {
      externalKind: parsed.externalKind,
      externalId: parsed.externalId,
    };
  }
}

export const unitExternalRefService = new UnitExternalRefService();

import type {
  CreateTranslationInput,
  EditorialPatchSubmission,
  RezicsSessionClaims,
  UpdateTranslationInput,
} from "@rezics/contract";
import { FALLBACK_LANGUAGE } from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { and, asc, desc, eq } from "drizzle-orm";
import { serverJobProducer } from "@/job/job-boundary";
import { Unit, UnitSupportLanguage, UnitTranslation } from "../db/schema";
import { generateBetween } from "../shelf/fractional-index";
import {
  applySparsePatch,
  assertCanEditCollaborativeMetadata,
  createDrizzleCollaborativeMetadataTx,
  hasOwn,
  mapActualTranslationPatchPaths,
  translationPatchFromPaths,
  writeEditorialMetadataHistory,
} from "./collaborative-metadata";
import { assertUnitTranslationExtraAllowed } from "./translation-extra";

type UnitTranslationRow = typeof UnitTranslation.$inferSelect;

type TranslationTx = {
  findTranslation(
    unitId: string,
    language: string,
  ): Promise<UnitTranslationRow | null>;
  upsertTranslation(
    unitId: string,
    language: string,
    create: Partial<UnitTranslationRow>,
    update: Partial<UnitTranslationRow>,
  ): Promise<UnitTranslationRow>;
  ensureSupportLanguage?(unitId: string, language: string): Promise<void>;
  unit?: unknown;
  unitCollaborator?: unknown;
  unitFieldLock?: unknown;
  staffAuditLog?: unknown;
  historyOutbox?: unknown;
  $queryRaw?: unknown;
};

type TranslationRepository = {
  getTranslation(unitId: string, language: string): Promise<UnitTranslationRow>;
  listByUnitId(unitId: string): Promise<UnitTranslationRow[]>;
  transaction<T>(callback: (tx: TranslationTx) => Promise<T>): Promise<T>;
  getUnitType(unitId: string): Promise<string | null>;
  deleteTranslation(unitId: string, language: string): Promise<void>;
  findTranslation(
    unitId: string,
    language: string,
  ): Promise<UnitTranslationRow | null>;
  findFirstTranslation(unitId: string): Promise<UnitTranslationRow | null>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function createDrizzleTranslationTx(db: any): TranslationTx {
  return {
    ...createDrizzleCollaborativeMetadataTx(db),
    async findTranslation(unitId, language) {
      const [row] = await db
        .select()
        .from(UnitTranslation)
        .where(
          and(
            eq(UnitTranslation.unitId, unitId),
            eq(UnitTranslation.language, language),
          ),
        )
        .limit(1);
      return row ?? null;
    },
    async upsertTranslation(unitId, language, create, update) {
      const [row] = await db
        .insert(UnitTranslation)
        .values({
          unitId,
          language,
          title: create.title ?? null,
          subtitle: create.subtitle ?? null,
          summary: create.summary ?? null,
          description: create.description ?? null,
          extra: create.extra ?? null,
          sourceUnitId: create.sourceUnitId ?? null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [UnitTranslation.unitId, UnitTranslation.language],
          set: { ...update, updatedAt: new Date() },
        })
        .returning();
      if (!row) throw new Error("Failed to upsert UnitTranslation");
      return row;
    },
    async ensureSupportLanguage(unitId, language) {
      const [last] = await db
        .select({
          language: UnitSupportLanguage.language,
          position: UnitSupportLanguage.position,
        })
        .from(UnitSupportLanguage)
        .where(eq(UnitSupportLanguage.unitId, unitId))
        .orderBy(desc(UnitSupportLanguage.position))
        .limit(1);
      await db
        .insert(UnitSupportLanguage)
        .values({
          unitId,
          language,
          isPrimary: !last,
          position: generateBetween(last?.position, undefined),
          updatedAt: new Date(),
        })
        .onConflictDoNothing();
    },
  };
}

function createDrizzleTranslationRepository(): TranslationRepository {
  return {
    async getTranslation(unitId, language) {
      const db = await getServerDb();
      const row = await createDrizzleTranslationTx(db).findTranslation(
        unitId,
        language,
      );
      if (!row) {
        throw new Error(`No UnitTranslation found for ${unitId}:${language}`);
      }
      return row;
    },
    async listByUnitId(unitId) {
      const db = await getServerDb();
      return db
        .select()
        .from(UnitTranslation)
        .where(eq(UnitTranslation.unitId, unitId))
        .orderBy(asc(UnitTranslation.language));
    },
    async transaction(callback) {
      const db = await getServerDb();
      return db.transaction((tx) => callback(createDrizzleTranslationTx(tx)));
    },
    async getUnitType(unitId) {
      const db = await getServerDb();
      const [unit] = await db
        .select({ type: Unit.type })
        .from(Unit)
        .where(eq(Unit.id, unitId))
        .limit(1);
      return unit?.type ?? null;
    },
    async deleteTranslation(unitId, language) {
      const db = await getServerDb();
      await db
        .delete(UnitTranslation)
        .where(
          and(
            eq(UnitTranslation.unitId, unitId),
            eq(UnitTranslation.language, language),
          ),
        );
    },
    async findTranslation(unitId, language) {
      const db = await getServerDb();
      return createDrizzleTranslationTx(db).findTranslation(unitId, language);
    },
    async findFirstTranslation(unitId) {
      const db = await getServerDb();
      const [row] = await db
        .select()
        .from(UnitTranslation)
        .where(eq(UnitTranslation.unitId, unitId))
        .orderBy(asc(UnitTranslation.language))
        .limit(1);
      return row ?? null;
    },
  };
}

/**
 * Translation Service - CRUD for UnitTranslation rows
 */
export class TranslationService {
  constructor(
    private readonly repository: TranslationRepository = createDrizzleTranslationRepository(),
  ) {}

  /**
   * Get a specific translation by composite key
   */
  async getTranslation(
    unitId: string,
    language: string,
  ): Promise<UnitTranslationRow> {
    return this.repository.getTranslation(unitId, language);
  }

  /**
   * List all translations for a unit
   */
  async listByUnitId(unitId: string): Promise<UnitTranslationRow[]> {
    return this.repository.listByUnitId(unitId);
  }

  /**
   * Upsert a translation (create or update)
   */
  async upsertTranslation(
    unitId: string,
    language: string,
    data: CreateTranslationInput | UpdateTranslationInput,
    actor?: RezicsSessionClaims,
    historyInput?: Pick<
      EditorialPatchSubmission,
      "patch" | "message" | "restoreSource"
    >,
  ): Promise<UnitTranslationRow> {
    let didMutate = false;
    const result = await this.repository.transaction(async (tx) => {
      const previous = await tx.findTranslation(unitId, language);
      const nextExtra =
        hasOwn(data, "extra") && data.extra !== undefined
          ? applySparsePatch(previous?.extra ?? {}, data.extra)
          : previous?.extra;
      assertUnitTranslationExtraAllowed(nextExtra);

      const createPayload: Partial<UnitTranslationRow> = {
        title: data.title ?? null,
        subtitle: data.subtitle ?? null,
        summary: data.summary ?? null,
        description: data.description !== undefined ? data.description : null,
        extra: nextExtra ?? null,
        sourceUnitId:
          "sourceUnitId" in data ? (data.sourceUnitId ?? null) : null,
      };

      const updatePayload: Partial<UnitTranslationRow> = {};
      if (hasOwn(data, "title")) updatePayload.title = data.title ?? null;
      if (hasOwn(data, "subtitle")) {
        updatePayload.subtitle = data.subtitle ?? null;
      }
      if (hasOwn(data, "summary")) updatePayload.summary = data.summary ?? null;
      if (data.description !== undefined) {
        updatePayload.description = data.description;
      }
      if (hasOwn(data, "extra") && data.extra !== undefined) {
        updatePayload.extra = nextExtra ?? null;
      }
      if ("sourceUnitId" in data) {
        updatePayload.sourceUnitId = data.sourceUnitId ?? null;
      }

      const patchPaths = mapActualTranslationPatchPaths(
        data,
        previous,
        language,
      );
      if (previous && patchPaths.length === 0) {
        return previous;
      }

      if (actor) {
        await assertCanEditCollaborativeMetadata(
          tx as any,
          actor,
          unitId,
          patchPaths,
        );
      }
      const row = await tx.upsertTranslation(
        unitId,
        language,
        createPayload,
        updatePayload,
      );
      await tx.ensureSupportLanguage?.(unitId, language);
      didMutate = true;
      if (actor) {
        await writeEditorialMetadataHistory(tx as any, {
          unitId,
          actorUserId: actor.userId,
          patch:
            historyInput?.patch ??
            translationPatchFromPaths(language, data, patchPaths),
          message: historyInput?.message ?? "unit.translation.upsert",
          restoreSource: historyInput?.restoreSource,
        });
      }
      return row;
    });

    if (didMutate) {
      await this.syncSearchOnTranslationChange(unitId);
    }

    return result;
  }

  private async syncSearchOnTranslationChange(unitId: string): Promise<void> {
    const type = await this.repository.getUnitType(unitId);
    if (!type) return;

    if (type === "REALM") {
      await serverJobProducer.enqueue(
        createSearchCommand(
          SEARCH_COMMAND_KINDS.realmPatchTranslations,
          { unitId },
          { type: "server", service: "unit-translation" },
        ),
      );
    } else if (type === "TAG") {
      await Promise.all([
        serverJobProducer.enqueue(
          createSearchCommand(
            SEARCH_COMMAND_KINDS.tagSync,
            { unitId },
            { type: "server", service: "unit-translation" },
          ),
        ),
        serverJobProducer.enqueue(
          createSearchCommand(
            SEARCH_COMMAND_KINDS.contentPatchTagFanout,
            { targetId: unitId },
            { type: "server", service: "unit-translation" },
          ),
        ),
      ]);
    } else if (type === "LABEL") {
      await serverJobProducer.enqueue(
        createSearchCommand(
          SEARCH_COMMAND_KINDS.labelSync,
          { unitId },
          { type: "server", service: "unit-translation" },
        ),
      );
    } else {
      await Promise.all([
        serverJobProducer.enqueue(
          createSearchCommand(
            SEARCH_COMMAND_KINDS.contentPatchTranslations,
            { unitId },
            { type: "server", service: "unit-translation" },
          ),
        ),
        serverJobProducer.enqueue(
          createSearchCommand(
            SEARCH_COMMAND_KINDS.postPatchTargetFanout,
            { targetId: unitId },
            { type: "server", service: "unit-translation" },
          ),
        ),
      ]);
    }
  }

  /**
   * Delete a translation
   */
  async deleteTranslation(unitId: string, language: string): Promise<void> {
    await this.repository.deleteTranslation(unitId, language);
  }

  /**
   * Resolve the best translation for a unit given requested and default languages.
   *
   * Precedence: requestedLang -> defaultLang -> 'en' (platform fallback) -> first available
   */
  async resolveTranslation(
    unitId: string,
    requestedLang?: string,
    defaultLang?: string,
  ): Promise<UnitTranslationRow | null> {
    // 1. Try requested language first
    if (requestedLang) {
      const match = await this.repository.findTranslation(
        unitId,
        requestedLang,
      );
      if (match) return match;
    }

    // 2. Fall back to unit's default language
    if (defaultLang && defaultLang !== requestedLang) {
      const match = await this.repository.findTranslation(unitId, defaultLang);
      if (match) return match;
    }

    // 3. Fall back to platform fallback language ('en')
    if (
      FALLBACK_LANGUAGE !== requestedLang &&
      FALLBACK_LANGUAGE !== defaultLang
    ) {
      const match = await this.repository.findTranslation(
        unitId,
        FALLBACK_LANGUAGE,
      );
      if (match) return match;
    }

    // 4. Fall back to first available translation
    return this.repository.findFirstTranslation(unitId);
  }
}

export const translationService = new TranslationService();

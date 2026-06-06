import type { UpsertContentTranslationInput } from "@rezics/contract";
import { and, asc, eq } from "drizzle-orm";
import { ContentTranslation, UnitSupportLanguage } from "../db/schema";
import type { ContentTranslationRow } from "./types";

export type ContentTranslationUpsertData = {
  unitId: string;
  language: string;
  content: unknown;
  createStatus: ContentTranslationRow["status"];
  updateStatus?: ContentTranslationRow["status"];
  sourceUnitId?: string | null;
  authorUserId?: string | null;
  provenance?: unknown;
};

export type ContentTranslationRepository = {
  get(unitId: string, language: string): Promise<ContentTranslationRow>;
  list(unitId: string): Promise<ContentTranslationRow[]>;
  upsert(data: ContentTranslationUpsertData): Promise<ContentTranslationRow>;
  delete(unitId: string, language: string): Promise<void>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function createDrizzleContentTranslationRepository(): ContentTranslationRepository {
  return {
    async get(unitId, language) {
      const db = await getServerDb();
      const [row] = await db
        .select()
        .from(ContentTranslation)
        .where(
          and(
            eq(ContentTranslation.unitId, unitId),
            eq(ContentTranslation.language, language),
          ),
        )
        .limit(1);
      if (!row) {
        throw new Error("Content translation not found");
      }
      return row;
    },

    async list(unitId) {
      const db = await getServerDb();
      return db
        .select()
        .from(ContentTranslation)
        .where(eq(ContentTranslation.unitId, unitId))
        .orderBy(asc(ContentTranslation.language));
    },

    async upsert(data) {
      const db = await getServerDb();
      return db.transaction(async (tx) => {
        const now = new Date();
        const [row] = await tx
          .insert(ContentTranslation)
          .values({
            unitId: data.unitId,
            language: data.language,
            content: data.content,
            status: data.createStatus,
            sourceUnitId: data.sourceUnitId ?? null,
            authorUserId: data.authorUserId ?? null,
            provenance: data.provenance ?? null,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [ContentTranslation.unitId, ContentTranslation.language],
            set: {
              content: data.content,
              status: data.updateStatus,
              sourceUnitId: data.sourceUnitId,
              authorUserId: data.authorUserId,
              provenance: data.provenance,
              updatedAt: now,
            },
          })
          .returning();
        if (!row) {
          throw new Error("Content translation was not upserted");
        }

        await tx
          .insert(UnitSupportLanguage)
          .values({
            unitId: data.unitId,
            language: data.language,
            isPrimary: false,
          })
          .onConflictDoNothing({
            target: [UnitSupportLanguage.unitId, UnitSupportLanguage.language],
          });

        return row;
      });
    },

    async delete(unitId, language) {
      const db = await getServerDb();
      await db
        .delete(ContentTranslation)
        .where(
          and(
            eq(ContentTranslation.unitId, unitId),
            eq(ContentTranslation.language, language),
          ),
        );
    },
  };
}

export class ContentTranslationService {
  constructor(
    private readonly repository = createDrizzleContentTranslationRepository(),
  ) {}

  async get(unitId: string, language: string): Promise<ContentTranslationRow> {
    return this.repository.get(unitId, language);
  }

  async list(unitId: string): Promise<ContentTranslationRow[]> {
    return this.repository.list(unitId);
  }

  async upsert(
    input: UpsertContentTranslationInput,
    actorUserId?: string,
  ): Promise<ContentTranslationRow> {
    return this.repository.upsert({
      unitId: input.unitId,
      language: input.language,
      content: input.content,
      createStatus: input.status ?? "PUBLISHED",
      updateStatus: input.status,
      sourceUnitId: input.sourceUnitId,
      authorUserId:
        input.authorUserId === undefined
          ? actorUserId
          : (input.authorUserId ?? actorUserId),
      provenance: input.provenance,
    });
  }

  async delete(unitId: string, language: string): Promise<void> {
    await this.repository.delete(unitId, language);
  }
}

export const contentTranslationService = new ContentTranslationService();

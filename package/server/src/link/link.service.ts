import type {
  CreateLinkInput,
  LinkDTO,
  UpdateLinkInput,
} from "@rezics/contract";
import { eq } from "drizzle-orm";
import { Link, Unit, UnitTranslation } from "../db/schema";
import { notFound } from "../utils/errors";
import { mapLinkToDTO } from "./link.mapper";
import type { LinkWithRelations } from "./link.types";

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

async function loadLinkWithRelations(
  unitId: string,
): Promise<LinkWithRelations | null> {
  const db = await getServerDb();
  const [link] = await db.select().from(Link).where(eq(Link.unitId, unitId));
  if (!link) return null;

  const [unit, translations] = await Promise.all([
    db.select().from(Unit).where(eq(Unit.id, unitId)).limit(1),
    db.select().from(UnitTranslation).where(eq(UnitTranslation.unitId, unitId)),
  ]);

  return {
    ...link,
    unit: unit[0] ? { ...unit[0], translations } : null,
  };
}

export class LinkService {
  async create(input: CreateLinkInput, userId: string): Promise<LinkDTO> {
    const { url, title, description, siteName, faviconUrl, extra } = input;
    const db = await getServerDb();
    const now = new Date();

    const [unit] = await db
      .insert(Unit)
      .values({
        userId,
        slugScope: userId,
        type: "LINK",
        status: "PUBLISHED",
        visibility: "PUBLIC",
        defaultLanguage: "en",
        updatedAt: now,
      })
      .returning();
    if (!unit) throw new Error("Failed to create link Unit");

    if (title || description) {
      await db.insert(UnitTranslation).values({
        unitId: unit.id,
        language: "en",
        title: title ?? url,
        description,
        updatedAt: now,
      });
    }

    await db.insert(Link).values({
      unitId: unit.id,
      url,
      siteName,
      faviconUrl,
      extra: extra ?? null,
      updatedAt: now,
    });

    const row = await loadLinkWithRelations(unit.id);
    if (!row) throw new Error("Failed to load created Link");
    return mapLinkToDTO(row);
  }

  async getByUnitId(unitId: string): Promise<LinkDTO> {
    const row = await loadLinkWithRelations(unitId);
    if (!row) throw notFound("Link");
    return mapLinkToDTO(row);
  }

  async update(unitId: string, input: UpdateLinkInput): Promise<LinkDTO> {
    const { url, title, description, siteName, faviconUrl, extra } = input;
    const db = await getServerDb();
    const now = new Date();

    if (title !== undefined || description !== undefined) {
      await db
        .insert(UnitTranslation)
        .values({
          unitId,
          language: "en",
          title,
          description,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [UnitTranslation.unitId, UnitTranslation.language],
          set: {
            ...(title !== undefined ? { title } : {}),
            ...(description !== undefined ? { description } : {}),
            updatedAt: now,
          },
        });
    }

    await db
      .update(Link)
      .set({
        url: url ?? undefined,
        siteName: siteName !== undefined ? siteName : undefined,
        faviconUrl: faviconUrl !== undefined ? faviconUrl : undefined,
        extra: extra !== undefined ? extra : undefined,
        updatedAt: now,
      })
      .where(eq(Link.unitId, unitId));

    const row = await loadLinkWithRelations(unitId);
    if (!row) throw notFound("Link");
    return mapLinkToDTO(row);
  }

  async delete(unitId: string): Promise<void> {
    const db = await getServerDb();
    await db.delete(Unit).where(eq(Unit.id, unitId));
  }
}

export const linkService = new LinkService();

import type { DispatchResult } from "@rezics/contract";
import { DispatchType, withCoverUrl } from "@rezics/contract";
import { and, eq } from "drizzle-orm";
import { nullableContentDocJson } from "@/content-doc/json-write";
import { env } from "@/env";
import { gameMediaLibraryService } from "@/game-media-library";
import { assertUnitTranslationExtraAllowed } from "@/unit/translation-extra";
import {
  Book,
  CreditAttribution,
  Game,
  Media,
  Unit,
  UnitTranslation,
} from "../db/schema";
import { rebalance } from "../shelf/fractional-index";
import type { DispatchConfig } from "./dispatch.types";

type DispatchTranslationInput = {
  language?: unknown;
  title?: unknown;
  subtitle?: unknown;
  summary?: unknown;
  description?: unknown;
  extra?: unknown;
};

type DispatchCreditInput = {
  entityId: string;
  role: string;
  position: string;
};

type DispatchTranslationMutation = {
  unitId: string;
  language: string;
  title?: string;
  subtitle?: string;
  summary?: string;
  description?: unknown;
  createExtra: unknown | null;
  updateExtra?: unknown | null;
};

type DispatchCreditMutation = {
  unitId: string;
  entityId: string;
  role: string;
  position: string;
};

type BookMutation = Partial<
  Pick<
    typeof Book.$inferInsert,
    | "isbn13"
    | "pageCount"
    | "textLength"
    | "isLicensed"
    | "publicationDate"
    | "formatKey"
    | "extra"
  >
>;

type GameMutation = Partial<
  Pick<
    typeof Game.$inferInsert,
    "releaseDate" | "versionLabel" | "isLicensed" | "extra"
  >
>;

type MediaMutation = Partial<
  Pick<
    typeof Media.$inferInsert,
    | "kindKey"
    | "releaseDate"
    | "runtimeMinutes"
    | "episodeCount"
    | "seasonCount"
    | "isLicensed"
    | "extra"
  >
>;

export type DispatchRepository = {
  getUnitDefaultLanguage(unitId: string): Promise<string | null>;
  getTranslationExtra(unitId: string, language: string): Promise<unknown>;
  upsertTranslation(input: DispatchTranslationMutation): Promise<void>;
  upsertCredit(input: DispatchCreditMutation): Promise<void>;
  updateBook(unitId: string, data: BookMutation): Promise<void>;
  createBookUnit(userId: string, data: BookMutation): Promise<string>;
  updateGame(unitId: string, data: GameMutation): Promise<void>;
  createGameUnit(userId: string, data: GameMutation): Promise<string>;
  updateMedia(unitId: string, data: MediaMutation): Promise<void>;
  createMediaUnit(userId: string, data: MediaMutation): Promise<string>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function hasTranslationMetadata(data: Record<string, unknown>): boolean {
  return (
    data.coverUrl !== undefined ||
    data.title !== undefined ||
    data.subtitle !== undefined ||
    data.summary !== undefined ||
    data.description !== undefined ||
    Array.isArray(data.translations)
  );
}

function readTranslationInputs(
  data: Record<string, unknown>,
  defaultLanguage: string,
): DispatchTranslationInput[] {
  if (Array.isArray(data.translations)) {
    const translations = data.translations.filter(
      (item): item is DispatchTranslationInput =>
        !!item && typeof item === "object" && !Array.isArray(item),
    );
    if (
      data.coverUrl !== undefined &&
      !translations.some((item) => item.language === defaultLanguage)
    ) {
      return [...translations, { language: defaultLanguage }];
    }
    return translations;
  }

  if (!hasTranslationMetadata(data)) return [];

  return [
    {
      language: defaultLanguage,
      title: data.title,
      subtitle: data.subtitle,
      summary: data.summary,
      description: data.description,
    },
  ];
}

function readBookMutation(data: Record<string, unknown>): BookMutation {
  return {
    ...(data.isbn13 !== undefined && { isbn13: data.isbn13 as string }),
    ...(data.pageCount !== undefined && {
      pageCount: data.pageCount as number,
    }),
    ...(data.textLength !== undefined && {
      textLength: data.textLength as number,
    }),
    ...(data.isLicensed !== undefined && {
      isLicensed: data.isLicensed as boolean,
    }),
    ...(data.publicationDate !== undefined && {
      publicationDate: new Date(data.publicationDate as string),
    }),
    ...(data.formatKey !== undefined && {
      formatKey: data.formatKey as string,
    }),
    ...(data.extra !== undefined && { extra: data.extra }),
  };
}

function readGameMutation(data: Record<string, unknown>): GameMutation {
  return {
    ...(data.releaseDate !== undefined && {
      releaseDate: new Date(data.releaseDate as string),
    }),
    ...(data.versionLabel !== undefined && {
      versionLabel: data.versionLabel as string,
    }),
    ...(data.isLicensed !== undefined && {
      isLicensed: data.isLicensed as boolean,
    }),
    ...(data.extra !== undefined && { extra: data.extra }),
  };
}

function readMediaMutation(data: Record<string, unknown>): MediaMutation {
  return {
    ...(data.kindKey !== undefined && {
      kindKey: data.kindKey as string,
    }),
    ...(data.releaseDate !== undefined && {
      releaseDate: new Date(data.releaseDate as string),
    }),
    ...(data.runtimeMinutes !== undefined && {
      runtimeMinutes: data.runtimeMinutes as number,
    }),
    ...(data.episodeCount !== undefined && {
      episodeCount: data.episodeCount as number,
    }),
    ...(data.seasonCount !== undefined && {
      seasonCount: data.seasonCount as number,
    }),
    ...(data.isLicensed !== undefined && {
      isLicensed: data.isLicensed as boolean,
    }),
    ...(data.extra !== undefined && { extra: data.extra }),
  };
}

function readCreditInputs(
  data: Record<string, unknown>,
): DispatchCreditInput[] {
  const explicit = data.creditAttributions ?? data.credits;

  if (Array.isArray(explicit)) {
    const positions = rebalance(explicit.length);
    return explicit.flatMap((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const record = item as Record<string, unknown>;
      if (
        typeof record.entityId !== "string" ||
        typeof record.role !== "string"
      )
        return [];
      return [
        {
          entityId: record.entityId,
          role: record.role,
          position:
            typeof record.position === "string"
              ? record.position
              : positions[index]!,
        },
      ];
    });
  }

  if (!explicit || typeof explicit !== "object") return [];

  return Object.entries(explicit as Record<string, unknown>).flatMap(
    ([role, entries]) => {
      if (!Array.isArray(entries)) return [];
      const positions = rebalance(entries.length);
      return entries.flatMap((entry, index) => {
        if (typeof entry === "string") {
          return [{ entityId: entry, role, position: positions[index]! }];
        }
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          return [];
        }
        const record = entry as Record<string, unknown>;
        if (typeof record.entityId !== "string") return [];
        return [
          {
            entityId: record.entityId,
            role,
            position:
              typeof record.position === "string"
                ? record.position
                : positions[index]!,
          },
        ];
      });
    },
  );
}

function translationCreatePayload(
  input: DispatchTranslationMutation,
): typeof UnitTranslation.$inferInsert {
  return {
    unitId: input.unitId,
    language: input.language,
    title: input.title ?? null,
    subtitle: input.subtitle ?? null,
    summary: input.summary ?? null,
    description:
      input.description === undefined ? null : (input.description as unknown),
    extra: input.createExtra,
    updatedAt: new Date(),
  };
}

function translationUpdatePayload(
  input: DispatchTranslationMutation,
): Partial<typeof UnitTranslation.$inferInsert> {
  return {
    ...(input.title !== undefined && { title: input.title }),
    ...(input.subtitle !== undefined && { subtitle: input.subtitle }),
    ...(input.summary !== undefined && { summary: input.summary }),
    ...(input.description !== undefined && {
      description: input.description,
    }),
    ...(input.updateExtra !== undefined && { extra: input.updateExtra }),
    updatedAt: new Date(),
  };
}

function createDrizzleDispatchRepository(): DispatchRepository {
  return {
    async getUnitDefaultLanguage(unitId) {
      const db = await getServerDb();
      const [unit] = await db
        .select({ defaultLanguage: Unit.defaultLanguage })
        .from(Unit)
        .where(eq(Unit.id, unitId))
        .limit(1);
      if (!unit) throw new Error(`Unit not found: ${unitId}`);
      return unit.defaultLanguage;
    },
    async getTranslationExtra(unitId, language) {
      const db = await getServerDb();
      const [translation] = await db
        .select({ extra: UnitTranslation.extra })
        .from(UnitTranslation)
        .where(
          and(
            eq(UnitTranslation.unitId, unitId),
            eq(UnitTranslation.language, language),
          ),
        )
        .limit(1);
      return translation?.extra;
    },
    async upsertTranslation(input) {
      const db = await getServerDb();
      await db
        .insert(UnitTranslation)
        .values(translationCreatePayload(input))
        .onConflictDoUpdate({
          target: [UnitTranslation.unitId, UnitTranslation.language],
          set: translationUpdatePayload(input),
        });
    },
    async upsertCredit(input) {
      const db = await getServerDb();
      await db
        .insert(CreditAttribution)
        .values(input)
        .onConflictDoUpdate({
          target: [
            CreditAttribution.unitId,
            CreditAttribution.entityId,
            CreditAttribution.role,
          ],
          set: { position: input.position },
        });
    },
    async updateBook(unitId, data) {
      const db = await getServerDb();
      await db
        .update(Book)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(Book.unitId, unitId));
    },
    async createBookUnit(userId, data) {
      const db = await getServerDb();
      return db.transaction(async (tx) => {
        const [unit] = await tx
          .insert(Unit)
          .values({
            type: "BOOK",
            userId,
            slugScope: userId,
            status: "DRAFT",
            updatedAt: new Date(),
          })
          .returning({ id: Unit.id });
        if (!unit) throw new Error("Failed to create book Unit");
        await tx
          .insert(Book)
          .values({ unitId: unit.id, ...data, updatedAt: new Date() });
        return unit.id;
      });
    },
    async updateGame(unitId, data) {
      const db = await getServerDb();
      await db
        .update(Game)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(Game.unitId, unitId));
    },
    async createGameUnit(userId, data) {
      const db = await getServerDb();
      return db.transaction(async (tx) => {
        const [unit] = await tx
          .insert(Unit)
          .values({
            type: "GAME",
            userId,
            slugScope: userId,
            status: "DRAFT",
            updatedAt: new Date(),
          })
          .returning({ id: Unit.id });
        if (!unit) throw new Error("Failed to create game Unit");
        await tx
          .insert(Game)
          .values({ unitId: unit.id, ...data, updatedAt: new Date() });
        return unit.id;
      });
    },
    async updateMedia(unitId, data) {
      const db = await getServerDb();
      await db
        .update(Media)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(Media.unitId, unitId));
    },
    async createMediaUnit(userId, data) {
      const db = await getServerDb();
      return db.transaction(async (tx) => {
        const [unit] = await tx
          .insert(Unit)
          .values({
            type: "MEDIA",
            userId,
            slugScope: userId,
            status: "DRAFT",
            updatedAt: new Date(),
          })
          .returning({ id: Unit.id });
        if (!unit) throw new Error("Failed to create media Unit");
        await tx.insert(Media).values({
          unitId: unit.id,
          ...data,
          kindKey: data.kindKey as string,
          updatedAt: new Date(),
        });
        return unit.id;
      });
    },
  };
}

async function persistTranslationMetadata(
  repository: DispatchRepository,
  unitId: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (!hasTranslationMetadata(data)) return;

  const language = (await repository.getUnitDefaultLanguage(unitId)) ?? "en";
  const translations = readTranslationInputs(data, language);

  for (const input of translations) {
    const inputLanguage =
      typeof input.language === "string" ? input.language : language;
    const existingExtra = await repository.getTranslationExtra(
      unitId,
      inputLanguage,
    );
    const baseExtra =
      input.extra !== undefined ? input.extra : (existingExtra ?? undefined);
    const nextExtra =
      data.coverUrl !== undefined && inputLanguage === language
        ? withCoverUrl(
            baseExtra,
            (data.coverUrl as string | null | undefined) ?? undefined,
          )
        : baseExtra;
    assertUnitTranslationExtraAllowed(nextExtra ?? null);

    await repository.upsertTranslation({
      unitId,
      language: inputLanguage,
      title: typeof input.title === "string" ? input.title : undefined,
      subtitle: typeof input.subtitle === "string" ? input.subtitle : undefined,
      summary: typeof input.summary === "string" ? input.summary : undefined,
      description: nullableContentDocJson(input.description),
      createExtra: nextExtra ?? null,
      updateExtra: nextExtra !== undefined ? (nextExtra ?? null) : undefined,
    });
  }
}

async function persistCreditAttributions(
  repository: DispatchRepository,
  unitId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const credits = readCreditInputs(data);
  for (const credit of credits) {
    await repository.upsertCredit({
      unitId,
      entityId: credit.entityId,
      role: credit.role,
      position: credit.position,
    });
  }
}

async function persistSharedLibraryMetadata(
  repository: DispatchRepository,
  unitId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await persistTranslationMetadata(repository, unitId, data);
  await persistCreditAttributions(repository, unitId, data);
}

export class DispatchService {
  constructor(
    private readonly repository: DispatchRepository = createDrizzleDispatchRepository(),
  ) {}

  getConfig(): DispatchConfig | null {
    const hubUrl = env.DISPATCH_HUB_URL;
    const receiptSecret = env.DISPATCH_RECEIPT_SECRET;
    const projectId = env.DISPATCH_PROJECT_ID;

    if (!hubUrl || !receiptSecret || !projectId) return null;

    return { hubUrl, receiptSecret, projectId };
  }

  async processResult(
    result: DispatchResult,
    userId: string,
  ): Promise<{ unitId: string }> {
    switch (result.type) {
      case DispatchType.BOOK:
        return this.processBook(result, userId);
      case DispatchType.GAME:
        return this.processGame(result, userId);
      case DispatchType.MEDIA:
        return this.processMedia(result, userId);
      default:
        throw new Error(`Unsupported dispatch type: ${result.type}`);
    }
  }

  private async processBook(
    result: DispatchResult,
    userId: string,
  ): Promise<{ unitId: string }> {
    const data = result.data as Record<string, unknown>;

    if (result.unitId) {
      await this.repository.updateBook(result.unitId, readBookMutation(data));
      await persistSharedLibraryMetadata(this.repository, result.unitId, data);
      return { unitId: result.unitId };
    }

    const unitId = await this.repository.createBookUnit(
      userId,
      readBookMutation(data),
    );
    await persistSharedLibraryMetadata(this.repository, unitId, data);
    return { unitId };
  }

  private async processGame(
    result: DispatchResult,
    userId: string,
  ): Promise<{ unitId: string }> {
    const data = result.data as Record<string, unknown>;

    if (result.unitId) {
      await this.repository.updateGame(result.unitId, readGameMutation(data));
      await persistSharedLibraryMetadata(this.repository, result.unitId, data);
      await gameMediaLibraryService.appendGameMetadataRelations(result.unitId, {
        platformEntityIds: data.platformEntityIds as string[] | undefined,
        ageRatingTagUnitIds: data.ageRatingTagUnitIds as string[] | undefined,
      });
      return { unitId: result.unitId };
    }

    const unitId = await this.repository.createGameUnit(
      userId,
      readGameMutation(data),
    );
    await persistSharedLibraryMetadata(this.repository, unitId, data);
    await gameMediaLibraryService.appendGameMetadataRelations(unitId, {
      platformEntityIds: data.platformEntityIds as string[] | undefined,
      ageRatingTagUnitIds: data.ageRatingTagUnitIds as string[] | undefined,
    });
    return { unitId };
  }

  private async processMedia(
    result: DispatchResult,
    userId: string,
  ): Promise<{ unitId: string }> {
    const data = result.data as Record<string, unknown>;

    if (result.unitId) {
      await this.repository.updateMedia(result.unitId, readMediaMutation(data));
      await persistSharedLibraryMetadata(this.repository, result.unitId, data);
      return { unitId: result.unitId };
    }

    if (!data.kindKey) {
      throw new Error("kindKey is required when creating a new media entity");
    }

    const unitId = await this.repository.createMediaUnit(
      userId,
      readMediaMutation(data),
    );
    await persistSharedLibraryMetadata(this.repository, unitId, data);
    return { unitId };
  }

  async notifyHub(taskIds: string[], project: string): Promise<void> {
    const config = this.getConfig();
    if (!config) return;

    const sorted = [...taskIds].sort();
    const payload = sorted.join(",") + ":" + project;
    const key = new TextEncoder().encode(config.receiptSecret);
    const data = new TextEncoder().encode(payload);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, data);
    const signature = Buffer.from(signatureBuffer).toString("hex");

    const url = `${config.hubUrl}/tasks/audit`;
    const body = JSON.stringify({ taskIds: sorted, project, signature });

    await this.notifyWithRetry(url, body);
  }

  private async notifyWithRetry(
    url: string,
    body: string,
    maxRetries = 3,
  ): Promise<void> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        if (res.ok) return;
        throw new Error(`Hub responded with ${res.status}`);
      } catch (err) {
        if (attempt < maxRetries - 1) {
          const delay = 2 ** attempt * 1000; // 1s, 2s, 4s
          await new Promise((r) => setTimeout(r, delay));
        } else {
          console.error(
            `[dispatch] Hub audit notification failed after ${maxRetries} attempts:`,
            err,
          );
        }
      }
    }
  }
}

export const dispatchService = new DispatchService();

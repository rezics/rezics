import type { DispatchResult } from "@rezics/contract";
import { DispatchType, withCoverUrl } from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma } from "#/prisma/client";
import { nullableContentDocJson } from "@/content-doc/prisma-json";
import { env } from "@/env";
import { gameMediaLibraryService } from "@/game-media-library";
import { assertUnitTranslationExtraAllowed } from "@/unit/translation-extra";
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
  sortOrder?: number;
};

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

function readCreditInputs(
  data: Record<string, unknown>,
): DispatchCreditInput[] {
  const explicit = data.creditAttributions ?? data.credits;

  if (Array.isArray(explicit)) {
    return explicit.flatMap((item) => {
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
          sortOrder:
            typeof record.sortOrder === "number" ? record.sortOrder : undefined,
        },
      ];
    });
  }

  if (!explicit || typeof explicit !== "object") return [];

  return Object.entries(explicit as Record<string, unknown>).flatMap(
    ([role, entries]) => {
      if (!Array.isArray(entries)) return [];
      return entries.flatMap((entry, index) => {
        if (typeof entry === "string") {
          return [{ entityId: entry, role, sortOrder: index }];
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
            sortOrder:
              typeof record.sortOrder === "number" ? record.sortOrder : index,
          },
        ];
      });
    },
  );
}

async function persistTranslationMetadata(
  unitId: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (!hasTranslationMetadata(data)) return;

  const unit = await prisma.unit.findUniqueOrThrow({
    where: { id: unitId },
    select: { defaultLanguage: true },
  });
  const language = unit.defaultLanguage ?? "en";
  const translations = readTranslationInputs(data, language);

  for (const input of translations) {
    const inputLanguage =
      typeof input.language === "string" ? input.language : language;
    const existing = await prisma.unitTranslation.findUnique({
      where: { unitId_language: { unitId, language: inputLanguage } },
      select: { extra: true },
    });
    const baseExtra =
      input.extra !== undefined ? input.extra : (existing?.extra ?? undefined);
    const nextExtra =
      data.coverUrl !== undefined && inputLanguage === language
        ? withCoverUrl(
            baseExtra,
            (data.coverUrl as string | null | undefined) ?? undefined,
          )
        : baseExtra;
    assertUnitTranslationExtraAllowed(nextExtra ?? null);

    await prisma.unitTranslation.upsert({
      where: { unitId_language: { unitId, language: inputLanguage } },
      create: {
        unitId,
        language: inputLanguage,
        title: typeof input.title === "string" ? input.title : undefined,
        subtitle:
          typeof input.subtitle === "string" ? input.subtitle : undefined,
        summary: typeof input.summary === "string" ? input.summary : undefined,
        description: nullableContentDocJson(input.description),
        extra: (nextExtra ?? null) as Prisma.InputJsonValue,
      },
      update: {
        title: typeof input.title === "string" ? input.title : undefined,
        subtitle:
          typeof input.subtitle === "string" ? input.subtitle : undefined,
        summary: typeof input.summary === "string" ? input.summary : undefined,
        description: nullableContentDocJson(input.description),
        extra:
          nextExtra !== undefined
            ? ((nextExtra ?? null) as Prisma.InputJsonValue)
            : undefined,
      },
    });
  }
}

async function persistCreditAttributions(
  unitId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const credits = readCreditInputs(data);
  for (const credit of credits) {
    await prisma.creditAttribution.upsert({
      where: {
        unitId_entityId_role: {
          unitId,
          entityId: credit.entityId,
          role: credit.role,
        },
      },
      create: {
        unitId,
        entityId: credit.entityId,
        role: credit.role,
        sortOrder: credit.sortOrder ?? 0,
      },
      update: { sortOrder: credit.sortOrder ?? 0 },
    });
  }
}

async function persistSharedLibraryMetadata(
  unitId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await persistTranslationMetadata(unitId, data);
  await persistCreditAttributions(unitId, data);
}

export class DispatchService {
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
      await prisma.book.update({
        where: { unitId: result.unitId },
        data: {
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
          ...(data.extra !== undefined && { extra: data.extra as any }),
        },
      });
      await persistSharedLibraryMetadata(result.unitId, data);
      return { unitId: result.unitId };
    }

    const unit = await prisma.unit.create({
      data: {
        type: "BOOK",
        userId,
        slugScope: userId,
        status: "DRAFT",
        book: {
          create: {
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
            ...(data.extra !== undefined && { extra: data.extra as any }),
          },
        },
      },
    });
    await persistSharedLibraryMetadata(unit.id, data);
    return { unitId: unit.id };
  }

  private async processGame(
    result: DispatchResult,
    userId: string,
  ): Promise<{ unitId: string }> {
    const data = result.data as Record<string, unknown>;

    if (result.unitId) {
      await prisma.game.update({
        where: { unitId: result.unitId },
        data: {
          ...(data.releaseDate !== undefined && {
            releaseDate: new Date(data.releaseDate as string),
          }),
          ...(data.versionLabel !== undefined && {
            versionLabel: data.versionLabel as string,
          }),
          ...(data.isLicensed !== undefined && {
            isLicensed: data.isLicensed as boolean,
          }),
          ...(data.extra !== undefined && { extra: data.extra as any }),
        },
      });
      await persistSharedLibraryMetadata(result.unitId, data);
      await gameMediaLibraryService.appendGameMetadataRelations(result.unitId, {
        platformEntityIds: data.platformEntityIds as string[] | undefined,
        ageRatingTagUnitIds: data.ageRatingTagUnitIds as string[] | undefined,
      });
      return { unitId: result.unitId };
    }

    const unit = await prisma.unit.create({
      data: {
        type: "GAME",
        userId,
        slugScope: userId,
        status: "DRAFT",
        game: {
          create: {
            ...(data.releaseDate !== undefined && {
              releaseDate: new Date(data.releaseDate as string),
            }),
            ...(data.versionLabel !== undefined && {
              versionLabel: data.versionLabel as string,
            }),
            ...(data.isLicensed !== undefined && {
              isLicensed: data.isLicensed as boolean,
            }),
            ...(data.extra !== undefined && { extra: data.extra as any }),
          },
        },
      },
    });
    await persistSharedLibraryMetadata(unit.id, data);
    await gameMediaLibraryService.appendGameMetadataRelations(unit.id, {
      platformEntityIds: data.platformEntityIds as string[] | undefined,
      ageRatingTagUnitIds: data.ageRatingTagUnitIds as string[] | undefined,
    });
    return { unitId: unit.id };
  }

  private async processMedia(
    result: DispatchResult,
    userId: string,
  ): Promise<{ unitId: string }> {
    const data = result.data as Record<string, unknown>;

    if (result.unitId) {
      await prisma.media.update({
        where: { unitId: result.unitId },
        data: {
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
          ...(data.extra !== undefined && { extra: data.extra as any }),
        },
      });
      await persistSharedLibraryMetadata(result.unitId, data);
      return { unitId: result.unitId };
    }

    if (!data.kindKey) {
      throw new Error("kindKey is required when creating a new media entity");
    }

    const unit = await prisma.unit.create({
      data: {
        type: "MEDIA",
        userId,
        slugScope: userId,
        status: "DRAFT",
        media: {
          create: {
            kindKey: data.kindKey as string,
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
            ...(data.extra !== undefined && { extra: data.extra as any }),
          },
        },
      },
    });
    await persistSharedLibraryMetadata(unit.id, data);
    return { unitId: unit.id };
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

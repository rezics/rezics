import type { DispatchResult } from "@rezics/contract";
import { DispatchType, withCoverUrl } from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma } from "#/prisma/client";
import { env } from "@/env";
import { gameMediaLibraryService } from "@/game-media-library";
import type { DispatchConfig } from "./dispatch.types";

async function persistCoverUrlToTranslation(
  unitId: string,
  coverUrl: string | null | undefined,
): Promise<void> {
  if (coverUrl === undefined) return;
  const unit = await prisma.unit.findUniqueOrThrow({
    where: { id: unitId },
    select: { defaultLanguage: true },
  });
  const language = unit.defaultLanguage ?? "en";
  const existing = await prisma.unitTranslation.findUnique({
    where: { unitId_language: { unitId, language } },
    select: { extra: true },
  });
  const nextExtra = withCoverUrl(
    existing?.extra ?? undefined,
    coverUrl ?? undefined,
  ) as Prisma.InputJsonValue;
  await prisma.unitTranslation.upsert({
    where: { unitId_language: { unitId, language } },
    create: { unitId, language, extra: nextExtra },
    update: { extra: nextExtra },
  });
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
      await persistCoverUrlToTranslation(
        result.unitId,
        data.coverUrl as string | null | undefined,
      );
      await gameMediaLibraryService.appendGameMetadataRelations(result.unitId, {
        platformEntityIds: data.platformEntityIds as string[] | undefined,
        ageRatingTagUnitIds: data.ageRatingTagUnitIds as string[] | undefined,
      });
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
    await persistCoverUrlToTranslation(
      unit.id,
      data.coverUrl as string | null | undefined,
    );
    await gameMediaLibraryService.appendGameMetadataRelations(unit.id, {
      platformEntityIds: data.platformEntityIds as string[] | undefined,
      ageRatingTagUnitIds: data.ageRatingTagUnitIds as string[] | undefined,
    });
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
      await persistCoverUrlToTranslation(
        result.unitId,
        data.coverUrl as string | null | undefined,
      );
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
    await persistCoverUrlToTranslation(
      unit.id,
      data.coverUrl as string | null | undefined,
    );
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
      await persistCoverUrlToTranslation(
        result.unitId,
        data.coverUrl as string | null | undefined,
      );
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
    await persistCoverUrlToTranslation(
      unit.id,
      data.coverUrl as string | null | undefined,
    );
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

import type { PinboardKey } from "@rezics/contract";
import type { Prisma } from "#/prisma/client";

/**
 * Prisma include shared by list reads. Carries every translation
 * so language resolution happens in-process after one round-trip.
 */
export const pinboardUnitInclude = {
  translations: true,
  post: true,
  translationGroup: {
    select: { id: true, supportedLanguages: true },
  },
} satisfies Prisma.UnitInclude;

export type PinboardUnitRow = Prisma.UnitGetPayload<{
  include: typeof pinboardUnitInclude;
}>;

export interface ReadListParams {
  realmUnitId: string;
  pinboardKey: PinboardKey;
  language?: string;
  adminView?: boolean;
}

export interface ReadDetailParams {
  realmUnitId: string;
  pinboardKey: PinboardKey;
  unitId: string;
  language?: string;
}

export interface PinboardTranslationData {
  language: string;
  title?: string;
  subtitle?: string;
  summary?: string;
  description?: string;
  body?: string;
}

export interface CreatePinboardEntryInput {
  defaultLanguage: string;
  translations: PinboardTranslationData[];
}

export interface UpdatePinboardEntryInput {
  upsert?: PinboardTranslationData[];
  remove?: string[];
}

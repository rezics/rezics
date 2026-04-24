import type {
  PinboardEntryDetailDTO,
  PinboardEntryDTO,
  PinboardKey,
} from "@rezics/contract";
import { PINBOARD_KEYS } from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma, UnitStatus, UnitType } from "#/prisma/client";
import { patchPostsTargetToMeili, syncPostToMeili } from "@/meili/post/sync";
import { translationGroupService } from "@/translation-group/translation-group.service";
import { AppError } from "@/utils/errors";
import {
  mapPinboardEntryDetailDTO,
  mapPinboardEntryDTO,
} from "./pinboard.mapper";
import {
  type CreatePinboardEntryInput,
  pinboardUnitInclude,
  type PinboardUnitRow,
  type ReadDetailParams,
  type ReadListParams,
  type UpdatePinboardEntryInput,
} from "./pinboard.types";

const EXTRA_KEY_SUFFIX = "PostIds" as const;

function extraKeyFor(pinboardKey: PinboardKey): string {
  return `${pinboardKey}${EXTRA_KEY_SUFFIX}`;
}

export function assertPinboardKey(
  key: string,
): asserts key is PinboardKey {
  if (!(PINBOARD_KEYS as readonly string[]).includes(key)) {
    throw new AppError(400, `Invalid pinboard key: ${key}`);
  }
}

/**
 * Read the ordered list of post ids for a single pinboard from Realm.extra.
 * Returns an empty array when the realm does not exist or has no list.
 */
async function readPostIdsFromExtra(
  tx: Prisma.TransactionClient,
  realmUnitId: string,
  pinboardKey: PinboardKey,
): Promise<string[]> {
  const row = await tx.realm.findUnique({
    where: { unitId: realmUnitId },
    select: { extra: true },
  });
  if (!row) throw new AppError(404, "Realm not found");
  const extra = (row.extra ?? {}) as Record<string, unknown>;
  const key = extraKeyFor(pinboardKey);
  const value = extra[key];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * Write a new post id list back to Realm.extra while preserving other keys.
 */
async function writePostIdsToExtra(
  tx: Prisma.TransactionClient,
  realmUnitId: string,
  pinboardKey: PinboardKey,
  postIds: string[],
): Promise<void> {
  const row = await tx.realm.findUnique({
    where: { unitId: realmUnitId },
    select: { extra: true },
  });
  if (!row) throw new AppError(404, "Realm not found");
  const extra = ((row.extra ?? {}) as Record<string, unknown>) ?? {};
  extra[extraKeyFor(pinboardKey)] = postIds;
  await tx.realm.update({
    where: { unitId: realmUnitId },
    data: { extra: extra as Prisma.InputJsonValue },
  });
}

/**
 * Acquire a row-level lock on the target Realm. Serializes concurrent
 * writes to `Realm.extra.<pinboardKey>PostIds`.
 *
 * TODO(pinboard-occ): swap this for an optimistic concurrency scheme
 * (version counter on Realm.extra) once write contention justifies it.
 */
async function lockRealmRow(
  tx: Prisma.TransactionClient,
  realmUnitId: string,
): Promise<void> {
  await tx.$queryRaw`SELECT unit_id FROM "Realm" WHERE unit_id = ${realmUnitId}::uuid FOR UPDATE`;
}

/**
 * Load referenced units + translations + translation group in one query,
 * preserving the id-order from `Realm.extra`.
 */
async function loadUnitsInOrder(
  postIds: string[],
): Promise<{ live: PinboardUnitRow[]; staleIds: string[] }> {
  if (postIds.length === 0) return { live: [], staleIds: [] };

  const rows = await prisma.unit.findMany({
    where: { id: { in: postIds } },
    include: pinboardUnitInclude,
  });

  const byId = new Map(rows.map((row) => [row.id, row]));

  const live: PinboardUnitRow[] = [];
  const staleIds: string[] = [];

  for (const id of postIds) {
    const row = byId.get(id);
    if (!row || row.status === UnitStatus.DELETED || row.type !== UnitType.POST) {
      staleIds.push(id);
    } else {
      live.push(row);
    }
  }

  return { live, staleIds };
}

export class PinboardService {
  /**
   * Read a pinboard list, resolving language per-entry. Public callers
   * never see stale ids; admin callers receive a separate `staleIds`
   * array so they can surface a cleanup affordance.
   */
  async readList(
    params: ReadListParams,
  ): Promise<{ entries: PinboardEntryDTO[]; staleIds?: string[] }> {
    assertPinboardKey(params.pinboardKey);

    const postIds = await readPostIdsFromExtra(
      prisma,
      params.realmUnitId,
      params.pinboardKey,
    );

    const { live, staleIds } = await loadUnitsInOrder(postIds);

    const entries = live.map((unit, index) =>
      mapPinboardEntryDTO(unit, {
        realmUnitId: params.realmUnitId,
        pinboardKey: params.pinboardKey,
        position: index,
        requestedLanguage: params.language,
      }),
    );

    return params.adminView ? { entries, staleIds } : { entries };
  }

  /**
   * Read a single pinboard entry's detail view. Resolves the body by
   * walking TranslationGroup siblings. Standalone units return their
   * own body.
   */
  async readDetail(params: ReadDetailParams): Promise<PinboardEntryDetailDTO> {
    assertPinboardKey(params.pinboardKey);

    const postIds = await readPostIdsFromExtra(
      prisma,
      params.realmUnitId,
      params.pinboardKey,
    );
    if (!postIds.includes(params.unitId)) {
      throw new AppError(404, "Pinboard entry not found");
    }

    const rootUnit = await prisma.unit.findUnique({
      where: { id: params.unitId },
      include: pinboardUnitInclude,
    });
    if (!rootUnit || rootUnit.status === UnitStatus.DELETED) {
      throw new AppError(404, "Pinboard entry not found");
    }

    const groupId = rootUnit.translationGroup?.id ?? null;
    if (!groupId) {
      return mapPinboardEntryDetailDTO(rootUnit, rootUnit, {
        realmUnitId: params.realmUnitId,
        pinboardKey: params.pinboardKey,
        requestedLanguage: params.language,
      });
    }

    const siblings = await prisma.unit.findMany({
      where: {
        translationGroupId: groupId,
        status: { not: UnitStatus.DELETED },
      },
      include: pinboardUnitInclude,
    });

    const byDefaultLanguage = new Map(
      siblings.map((s) => [s.defaultLanguage ?? "", s]),
    );

    const resolved =
      (params.language ? byDefaultLanguage.get(params.language) : undefined) ??
      (rootUnit.defaultLanguage
        ? byDefaultLanguage.get(rootUnit.defaultLanguage)
        : undefined) ??
      byDefaultLanguage.get("en") ??
      siblings[0] ??
      rootUnit;

    return mapPinboardEntryDetailDTO(rootUnit, resolved, {
      realmUnitId: params.realmUnitId,
      pinboardKey: params.pinboardKey,
      requestedLanguage: params.language,
    });
  }

  /**
   * Create a pinboard entry in one transaction: root Unit+Post+translation
   * → siblings + TranslationGroup (if multilingual) → append id to
   * Realm.extra under a row-level lock.
   */
  async createEntry(
    realmUnitId: string,
    pinboardKey: PinboardKey,
    input: CreatePinboardEntryInput,
    authorUserId: string,
  ): Promise<{ unitId: string }> {
    assertPinboardKey(pinboardKey);

    const defaultTranslation = input.translations.find(
      (t) => t.language === input.defaultLanguage,
    );
    if (!defaultTranslation) {
      throw new AppError(
        400,
        "translations must include the default language entry",
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      await lockRealmRow(tx, realmUnitId);

      const realm = await tx.realm.findUnique({
        where: { unitId: realmUnitId },
        select: { unitId: true },
      });
      if (!realm) throw new AppError(404, "Realm not found");

      const rootUnit = await tx.unit.create({
        data: {
          userId: authorUserId,
          type: UnitType.POST,
          status: UnitStatus.PUBLISHED,
          defaultLanguage: input.defaultLanguage,
          post: {
            create: {
              authorUserId,
              realmUnitId,
              body: defaultTranslation.body ?? null,
            },
          },
          translations: {
            create: {
              language: defaultTranslation.language,
              title: defaultTranslation.title ?? null,
              subtitle: defaultTranslation.subtitle ?? null,
              summary: defaultTranslation.summary ?? null,
              description: defaultTranslation.description ?? null,
            },
          },
          supportLanguages: {
            create: {
              language: defaultTranslation.language,
              isPrimary: true,
            },
          },
        },
        select: { id: true },
      });

      const extraLanguages = input.translations.filter(
        (t) => t.language !== input.defaultLanguage,
      );

      if (extraLanguages.length > 0) {
        const supportedLanguages = [
          input.defaultLanguage,
          ...extraLanguages.map((t) => t.language),
        ];
        const group = await tx.translationGroup.create({
          data: { supportedLanguages },
          select: { id: true },
        });
        await tx.unit.update({
          where: { id: rootUnit.id },
          data: { translationGroupId: group.id },
        });

        for (const tr of extraLanguages) {
          await tx.unit.create({
            data: {
              userId: authorUserId,
              type: UnitType.POST,
              status: UnitStatus.PUBLISHED,
              defaultLanguage: tr.language,
              translationGroupId: group.id,
              post: {
                create: {
                  authorUserId,
                  realmUnitId,
                  body: tr.body ?? null,
                },
              },
              translations: {
                create: {
                  language: tr.language,
                  title: tr.title ?? null,
                  subtitle: tr.subtitle ?? null,
                  summary: tr.summary ?? null,
                  description: tr.description ?? null,
                },
              },
              supportLanguages: {
                create: { language: tr.language, isPrimary: true },
              },
            },
          });
        }
      }

      const currentIds = await readPostIdsFromExtra(tx, realmUnitId, pinboardKey);
      if (!currentIds.includes(rootUnit.id)) {
        await writePostIdsToExtra(tx, realmUnitId, pinboardKey, [
          ...currentIds,
          rootUnit.id,
        ]);
      }

      return { unitId: rootUnit.id };
    });

    syncPostToMeili(result.unitId).catch(() => {});
    patchPostsTargetToMeili(realmUnitId).catch(() => {});

    return result;
  }

  /**
   * Composite update: upserts/removes translations and sibling posts
   * inside a single transaction. The default language cannot be removed.
   */
  async updateEntry(
    realmUnitId: string,
    pinboardKey: PinboardKey,
    unitId: string,
    input: UpdatePinboardEntryInput,
    authorUserId: string,
  ): Promise<{ unitId: string }> {
    assertPinboardKey(pinboardKey);

    await prisma.$transaction(async (tx) => {
      const rootUnit = await tx.unit.findUnique({
        where: { id: unitId },
        select: {
          id: true,
          defaultLanguage: true,
          translationGroupId: true,
        },
      });
      if (!rootUnit) throw new AppError(404, "Pinboard entry not found");
      if (!rootUnit.defaultLanguage) {
        throw new AppError(400, "Pinboard entry has no default language");
      }

      const ids = await readPostIdsFromExtra(tx, realmUnitId, pinboardKey);
      if (!ids.includes(unitId)) {
        throw new AppError(404, "Pinboard entry not found in this pinboard");
      }

      const siblingUnits = rootUnit.translationGroupId
        ? await tx.unit.findMany({
            where: {
              translationGroupId: rootUnit.translationGroupId,
              status: { not: UnitStatus.DELETED },
            },
            select: { id: true, defaultLanguage: true },
          })
        : [{ id: rootUnit.id, defaultLanguage: rootUnit.defaultLanguage }];

      const siblingByLang = new Map<
        string,
        { id: string; defaultLanguage: string | null }
      >();
      for (const s of siblingUnits) {
        if (s.defaultLanguage) siblingByLang.set(s.defaultLanguage, s);
      }

      // Remove languages (default protected).
      for (const lang of input.remove ?? []) {
        if (lang === rootUnit.defaultLanguage) {
          throw new AppError(
            400,
            "Default language cannot be removed from a pinboard entry",
          );
        }
        const target = siblingByLang.get(lang);
        if (!target) continue;
        await tx.unit.update({
          where: { id: target.id },
          data: { status: UnitStatus.DELETED },
        });
        await tx.post.update({
          where: { unitId: target.id },
          data: { body: null },
        });
        await translationGroupService.onUnitDeleted(tx, {
          id: target.id,
          translationGroupId: rootUnit.translationGroupId,
          defaultLanguage: target.defaultLanguage,
        });
        siblingByLang.delete(lang);
      }

      // Upsert languages.
      let groupId = rootUnit.translationGroupId;
      for (const tr of input.upsert ?? []) {
        const existing = siblingByLang.get(tr.language);

        if (existing) {
          // Update translation and optional sibling body.
          await tx.unitTranslation.upsert({
            where: {
              unitId_language: {
                unitId: existing.id,
                language: tr.language,
              },
            },
            create: {
              unitId: existing.id,
              language: tr.language,
              title: tr.title ?? null,
              subtitle: tr.subtitle ?? null,
              summary: tr.summary ?? null,
              description: tr.description ?? null,
            },
            update: {
              title: tr.title ?? undefined,
              subtitle: tr.subtitle ?? undefined,
              summary: tr.summary ?? undefined,
              description: tr.description ?? undefined,
            },
          });
          if (tr.body !== undefined) {
            await tx.post.update({
              where: { unitId: existing.id },
              data: { body: tr.body ?? null },
            });
          }
          continue;
        }

        // New language: create sibling. Lazily create the translation group
        // on the first sibling add.
        if (!groupId) {
          const group = await tx.translationGroup.create({
            data: { supportedLanguages: [rootUnit.defaultLanguage] },
            select: { id: true },
          });
          groupId = group.id;
          await tx.unit.update({
            where: { id: rootUnit.id },
            data: { translationGroupId: groupId },
          });
        }

        await tx.unit.create({
          data: {
            userId: authorUserId,
            type: UnitType.POST,
            status: UnitStatus.PUBLISHED,
            defaultLanguage: tr.language,
            translationGroupId: groupId,
            post: {
              create: {
                authorUserId,
                realmUnitId,
                body: tr.body ?? null,
              },
            },
            translations: {
              create: {
                language: tr.language,
                title: tr.title ?? null,
                subtitle: tr.subtitle ?? null,
                summary: tr.summary ?? null,
                description: tr.description ?? null,
              },
            },
            supportLanguages: {
              create: { language: tr.language, isPrimary: true },
            },
          },
        });

        await tx.translationGroup.update({
          where: { id: groupId },
          data: { supportedLanguages: { push: tr.language } },
        });
      }
    });

    syncPostToMeili(unitId).catch(() => {});

    return { unitId };
  }

  /**
   * Soft-delete the root unit and every sibling, and remove the id from
   * Realm.extra under a row-level lock. If the TranslationGroup becomes
   * empty it is deleted via `translationGroupService.onUnitDeleted`.
   */
  async deleteEntry(
    realmUnitId: string,
    pinboardKey: PinboardKey,
    unitId: string,
  ): Promise<void> {
    assertPinboardKey(pinboardKey);

    await prisma.$transaction(async (tx) => {
      await lockRealmRow(tx, realmUnitId);

      const rootUnit = await tx.unit.findUnique({
        where: { id: unitId },
        select: {
          id: true,
          defaultLanguage: true,
          translationGroupId: true,
        },
      });
      if (!rootUnit) throw new AppError(404, "Pinboard entry not found");

      const siblings = rootUnit.translationGroupId
        ? await tx.unit.findMany({
            where: {
              translationGroupId: rootUnit.translationGroupId,
            },
            select: { id: true, defaultLanguage: true },
          })
        : [{ id: rootUnit.id, defaultLanguage: rootUnit.defaultLanguage }];

      for (const s of siblings) {
        await tx.unit.update({
          where: { id: s.id },
          data: {
            status: UnitStatus.DELETED,
            translationGroupId: null,
          },
        });
        await tx.post.update({
          where: { unitId: s.id },
          data: { body: null },
        });
      }

      if (rootUnit.translationGroupId) {
        await tx.translationGroup
          .delete({ where: { id: rootUnit.translationGroupId } })
          .catch(() => {});
      }

      const currentIds = await readPostIdsFromExtra(tx, realmUnitId, pinboardKey);
      const next = currentIds.filter((id) => id !== unitId);
      if (next.length !== currentIds.length) {
        await writePostIdsToExtra(tx, realmUnitId, pinboardKey, next);
      }
    });

    syncPostToMeili(unitId).catch(() => {});
    patchPostsTargetToMeili(realmUnitId).catch(() => {});
  }

  async pinExisting(
    realmUnitId: string,
    pinboardKey: PinboardKey,
    unitId: string,
    position?: number,
  ): Promise<{ postIds: string[] }> {
    assertPinboardKey(pinboardKey);

    return prisma.$transaction(async (tx) => {
      await lockRealmRow(tx, realmUnitId);

      const unit = await tx.unit.findUnique({
        where: { id: unitId },
        select: { id: true, type: true, status: true },
      });
      if (!unit || unit.status === UnitStatus.DELETED) {
        throw new AppError(404, "Unit not found");
      }
      if (unit.type !== UnitType.POST) {
        throw new AppError(400, "Only POST units can be pinned");
      }

      const current = await readPostIdsFromExtra(tx, realmUnitId, pinboardKey);
      const withoutTarget = current.filter((id) => id !== unitId);
      const insertIndex =
        position === undefined
          ? withoutTarget.length
          : Math.max(0, Math.min(position, withoutTarget.length));
      const next = [
        ...withoutTarget.slice(0, insertIndex),
        unitId,
        ...withoutTarget.slice(insertIndex),
      ];
      await writePostIdsToExtra(tx, realmUnitId, pinboardKey, next);
      return { postIds: next };
    });
  }

  async unpin(
    realmUnitId: string,
    pinboardKey: PinboardKey,
    unitId: string,
  ): Promise<{ postIds: string[] }> {
    assertPinboardKey(pinboardKey);

    return prisma.$transaction(async (tx) => {
      await lockRealmRow(tx, realmUnitId);
      const current = await readPostIdsFromExtra(tx, realmUnitId, pinboardKey);
      const next = current.filter((id) => id !== unitId);
      if (next.length !== current.length) {
        await writePostIdsToExtra(tx, realmUnitId, pinboardKey, next);
      }
      return { postIds: next };
    });
  }

  /**
   * Replace the post id array. The new array must be a permutation of the
   * current one; otherwise 409 so the client can refresh and retry.
   */
  async reorder(
    realmUnitId: string,
    pinboardKey: PinboardKey,
    orderedUnitIds: string[],
  ): Promise<{ postIds: string[] }> {
    assertPinboardKey(pinboardKey);

    return prisma.$transaction(async (tx) => {
      await lockRealmRow(tx, realmUnitId);
      const current = await readPostIdsFromExtra(tx, realmUnitId, pinboardKey);

      const sameSet =
        current.length === orderedUnitIds.length &&
        new Set(current).size === new Set(orderedUnitIds).size &&
        orderedUnitIds.every((id) => current.includes(id));

      if (!sameSet) {
        throw new AppError(
          409,
          "Pinboard list changed — refresh and retry",
        );
      }

      await writePostIdsToExtra(tx, realmUnitId, pinboardKey, orderedUnitIds);
      return { postIds: orderedUnitIds };
    });
  }
}

export const pinboardService = new PinboardService();

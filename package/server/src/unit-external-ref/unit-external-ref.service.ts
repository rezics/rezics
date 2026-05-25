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
import { prisma } from "#/prisma/client";
import { AppError } from "@/utils/errors";
import { unitExternalRefInclude } from "./unit-external-ref.types";

type RefIdentity = {
  externalKind: ExternalKind;
  externalId: string;
  canonicalUrl: string;
  originalUrl?: string | null;
};

function sourceSiteRules(sourceSite: {
  refRules: unknown;
}): SourceSiteRefRule[] {
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

export class UnitExternalRefService {
  async list(query: UnitExternalRefListQuery = {}) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const limit = Math.max(1, Math.min(Number(query.limit ?? 50), 100));
    const skip = (page - 1) * limit;
    const where = {
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.sourceSiteEntityUnitId
        ? { sourceSiteEntityUnitId: query.sourceSiteEntityUnitId }
        : {}),
      ...(query.externalKind ? { externalKind: query.externalKind } : {}),
      ...(query.externalId ? { externalId: query.externalId } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.unitExternalRef.findMany({
        where,
        include: unitExternalRefInclude,
        orderBy: [{ lastSeenAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.unitExternalRef.count({ where }),
    ]);

    return { rows, total };
  }

  async create(input: CreateUnitExternalRefInput) {
    await prisma.unit.findUniqueOrThrow({
      where: { id: input.unitId },
      select: { id: true },
    });
    const sourceSite = await prisma.sourceSite.findUniqueOrThrow({
      where: { entityUnitId: input.sourceSiteEntityUnitId },
      select: { refRules: true },
    });
    const identity = deriveIdentity(input, sourceSiteRules(sourceSite));

    return prisma.unitExternalRef.create({
      data: {
        unitId: input.unitId,
        sourceSiteEntityUnitId: input.sourceSiteEntityUnitId,
        externalKind: identity.externalKind,
        externalId: identity.externalId,
        canonicalUrl: identity.canonicalUrl,
        originalUrl: identity.originalUrl ?? null,
        firstSeenAt: input.firstSeenAt
          ? new Date(input.firstSeenAt)
          : undefined,
        lastSeenAt: input.lastSeenAt ? new Date(input.lastSeenAt) : undefined,
      },
      include: unitExternalRefInclude,
    });
  }

  async update(id: string, input: UpdateUnitExternalRefInput) {
    const current = await prisma.unitExternalRef.findUniqueOrThrow({
      where: { id },
      select: {
        sourceSiteEntityUnitId: true,
        externalKind: true,
        externalId: true,
        originalUrl: true,
      },
    });
    const sourceSite = await prisma.sourceSite.findUniqueOrThrow({
      where: { entityUnitId: current.sourceSiteEntityUnitId },
      select: { refRules: true },
    });
    const identity =
      input.externalKind !== undefined ||
      input.externalId !== undefined ||
      input.observedUrl !== undefined
        ? deriveIdentity(
            {
              externalKind: input.externalKind ?? (current.externalKind as any),
              externalId: input.externalId ?? current.externalId,
              observedUrl: input.observedUrl,
              originalUrl: input.originalUrl ?? current.originalUrl,
            },
            sourceSiteRules(sourceSite),
          )
        : undefined;

    return prisma.unitExternalRef.update({
      where: { id },
      data: {
        externalKind: identity?.externalKind,
        externalId: identity?.externalId,
        canonicalUrl: identity?.canonicalUrl,
        originalUrl:
          input.originalUrl !== undefined
            ? input.originalUrl
            : identity?.originalUrl,
        firstSeenAt: input.firstSeenAt
          ? new Date(input.firstSeenAt)
          : undefined,
        lastSeenAt: input.lastSeenAt ? new Date(input.lastSeenAt) : undefined,
      },
      include: unitExternalRefInclude,
    });
  }

  async delete(id: string) {
    await prisma.unitExternalRef.delete({ where: { id } });
  }

  async parseUrl(sourceSiteEntityUnitId: string, url: string) {
    const sourceSite = await prisma.sourceSite.findUniqueOrThrow({
      where: { entityUnitId: sourceSiteEntityUnitId },
      select: { refRules: true },
    });
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

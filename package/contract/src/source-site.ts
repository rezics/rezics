import { t } from "elysia";
import { entityDTOSchema } from "./entity";
import {
  type ExternalKind,
  externalKindKeySchema,
  externalKinds,
} from "./external-kind";
import { listGetQueryBase, listPostBodyBase } from "./list-query-base";

export const sourceSiteCrawlSupportValues = [
  "none",
  "planned",
  "supported",
  "deprecated",
] as const;

export type SourceSiteCrawlSupport =
  (typeof sourceSiteCrawlSupportValues)[number];

export const sourceSiteCrawlSupportSchema = t.Union([
  t.Literal("none"),
  t.Literal("planned"),
  t.Literal("supported"),
  t.Literal("deprecated"),
]);

export const sourceSiteRefRuleSchema = t.Object(
  {
    externalKind: externalKindKeySchema,
    externalIdName: t.String({ minLength: 1 }),
    urlTemplate: t.String({ minLength: 1 }),
    urlMatchPattern: t.String({ minLength: 1 }),
    crawlerActionKey: t.Optional(t.Nullable(t.String({ minLength: 1 }))),
    crawlSupported: t.Optional(t.Boolean()),
  },
  { additionalProperties: false },
);

export type SourceSiteRefRule = (typeof sourceSiteRefRuleSchema)["static"];

export const sourceSiteRefRulesSchema = t.Array(sourceSiteRefRuleSchema);

export type SourceSiteRefRules = (typeof sourceSiteRefRulesSchema)["static"];

export const sourceSiteDTOSchema = t.Object({
  entityUnitId: t.String(),
  key: t.String(),
  crawlSupport: sourceSiteCrawlSupportSchema,
  crawlEnabled: t.Boolean(),
  crawlerAdapterKey: t.Optional(t.Nullable(t.String())),
  refRules: sourceSiteRefRulesSchema,
  supportsCrawl: t.Boolean(),
  canScheduleCrawl: t.Boolean(),
  entity: t.Optional(entityDTOSchema),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type SourceSiteDTO = (typeof sourceSiteDTOSchema)["static"];

export const createSourceSiteSchema = t.Object(
  {
    entityUnitId: t.String(),
    key: t.String({ minLength: 1 }),
    crawlSupport: sourceSiteCrawlSupportSchema,
    crawlEnabled: t.Optional(t.Boolean()),
    crawlerAdapterKey: t.Optional(t.Nullable(t.String({ minLength: 1 }))),
    refRules: sourceSiteRefRulesSchema,
  },
  { additionalProperties: false },
);

export type CreateSourceSiteInput = (typeof createSourceSiteSchema)["static"];

export const updateSourceSiteSchema = t.Object(
  {
    key: t.Optional(t.String({ minLength: 1 })),
    crawlSupport: t.Optional(sourceSiteCrawlSupportSchema),
    crawlEnabled: t.Optional(t.Boolean()),
    crawlerAdapterKey: t.Optional(t.Nullable(t.String({ minLength: 1 }))),
    refRules: t.Optional(sourceSiteRefRulesSchema),
  },
  { additionalProperties: false },
);

export type UpdateSourceSiteInput = (typeof updateSourceSiteSchema)["static"];

export const sourceSiteParamsSchema = t.Object({
  entityUnitId: t.String(),
});

export type SourceSiteParams = (typeof sourceSiteParamsSchema)["static"];

export const sourceSiteListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  q: t.Optional(t.String()),
  key: t.Optional(t.String()),
  crawlSupport: t.Optional(sourceSiteCrawlSupportSchema),
  crawlEnabled: t.Optional(t.Boolean()),
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});

export type SourceSiteListQuery = (typeof sourceSiteListQuerySchema)["static"];

export const sourceSiteListBodySchema = t.Object({
  ...listPostBodyBase.properties,
  q: t.Optional(t.String()),
  key: t.Optional(t.String()),
  crawlSupport: t.Optional(sourceSiteCrawlSupportSchema),
  crawlEnabled: t.Optional(t.Boolean()),
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});

export type SourceSiteListBody = (typeof sourceSiteListBodySchema)["static"];

export const sourceSiteListResponseSchema = t.Object({
  sourceSites: t.Array(sourceSiteDTOSchema),
  total: t.Number(),
});

export type SourceSiteListResponse =
  (typeof sourceSiteListResponseSchema)["static"];

export type ParsedSourceUrl = {
  externalKind: ExternalKind;
  externalId: string;
  rule: SourceSiteRefRule;
};

export function deriveSourceSiteCrawlStatus(input: {
  crawlSupport: SourceSiteCrawlSupport;
  crawlEnabled: boolean;
  crawlerAdapterKey?: string | null;
}): {
  supportsCrawl: boolean;
  canScheduleCrawl: boolean;
} {
  const supportsCrawl =
    input.crawlSupport === "supported" && Boolean(input.crawlerAdapterKey);

  return {
    supportsCrawl,
    canScheduleCrawl: supportsCrawl && input.crawlEnabled,
  };
}

export function buildCanonicalUrl(
  template: string,
  externalId: string,
): string {
  if (!template.includes("{externalId}")) {
    throw new Error("Source URL template must include {externalId}");
  }

  return template.replaceAll("{externalId}", encodeURIComponent(externalId));
}

export function parseSourceUrl(
  url: string,
  refRules: readonly SourceSiteRefRule[],
): ParsedSourceUrl | null {
  for (const rule of refRules) {
    const pattern = new RegExp(rule.urlMatchPattern);
    const match = pattern.exec(url);

    if (!match) {
      continue;
    }

    const externalId = match.groups?.externalId ?? match[1];

    if (!externalId) {
      continue;
    }

    return {
      externalKind: rule.externalKind,
      externalId: decodeURIComponent(externalId),
      rule,
    };
  }

  return null;
}

export function isValidSourceRefRules(
  refRules: readonly SourceSiteRefRule[],
): boolean {
  const seenKinds = new Set<ExternalKind>();

  for (const rule of refRules) {
    if (!externalKinds.includes(rule.externalKind)) {
      return false;
    }

    if (seenKinds.has(rule.externalKind)) {
      return false;
    }
    seenKinds.add(rule.externalKind);

    try {
      buildCanonicalUrl(rule.urlTemplate, "probe");
      const matcher = new RegExp(rule.urlMatchPattern);
      const canonicalUrl = buildCanonicalUrl(rule.urlTemplate, "probe");
      const match = matcher.exec(canonicalUrl);
      if (!match || !(match.groups?.externalId ?? match[1])) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

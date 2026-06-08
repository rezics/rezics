import type { Static } from "elysia";
import { t } from "elysia";
import { languageSchema } from "../language";
import { postKindLiterals } from "../post/post";
import { SlugRefSchema } from "../slug/slug-ref";
import { contentRatingSchema } from "../unit/unit";

// ANCHOR: Zone Filters
// ANCHOR: 专区筛选器

export const wikiZoneSubjectFilterSchema = t.Object(
  {
    entityIds: t.Optional(t.Array(t.String())),
    entityKinds: t.Optional(t.Array(t.String())),
    subjectRoles: t.Optional(t.Array(t.String())),
  },
  { additionalProperties: false },
);

export type WikiZoneSubjectFilter = Static<typeof wikiZoneSubjectFilterSchema>;

export const wikiZoneFiltersSchema = t.Object(
  {
    realmUnitId: t.String(),
    type: t.Optional(t.Union([t.Literal("POST"), t.Array(t.Literal("POST"))])),
    postKind: t.Optional(postKindLiterals),
    tags: t.Optional(t.Array(SlugRefSchema)),
    tagUnitIds: t.Optional(t.Array(t.String())),
    realmTagUnitIds: t.Optional(t.Array(t.String())),
    subjectFilters: t.Optional(t.Array(wikiZoneSubjectFilterSchema)),
    languages: t.Optional(t.Array(languageSchema)),
    wikiUnitIds: t.Optional(t.Array(t.String())),
    ratings: t.Optional(t.Array(contentRatingSchema)),
  },
  { additionalProperties: false },
);

export type WikiZoneFilters = Static<typeof wikiZoneFiltersSchema>;

export const ZoneFiltersSchema = t.Object(
  {
    type: t.Optional(t.Union([t.String(), t.Array(t.String())])),
    tags: t.Optional(t.Array(SlugRefSchema)),
    realmId: t.Optional(t.String()),
    realmUnitId: t.Optional(t.String()),
    postKind: t.Optional(postKindLiterals),
    ratings: t.Optional(t.Array(contentRatingSchema)),
    isLicensed: t.Optional(t.Boolean()),
    languages: t.Optional(t.Array(t.String())),
    subjectFilters: t.Optional(t.Array(wikiZoneSubjectFilterSchema)),
    wikiUnitIds: t.Optional(t.Array(t.String())),
  },
  { additionalProperties: false },
);

export type ZoneFilters = Static<typeof ZoneFiltersSchema>;

export const wikiZoneTranslatedLabelSchema = t.Object(
  {
    translations: t.Record(t.String(), t.String()),
    fallbackLanguage: t.Optional(languageSchema),
  },
  { additionalProperties: false },
);

export type WikiZoneTranslatedLabel = Static<
  typeof wikiZoneTranslatedLabelSchema
>;

export const wikiZoneNavigationItemSchema = t.Union([
  t.Object(
    {
      kind: t.Literal("entity"),
      entityId: t.String(),
      labelUnitId: t.Optional(t.String()),
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      kind: t.Literal("tag"),
      tagUnitId: t.String(),
      labelUnitId: t.Optional(t.String()),
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      kind: t.Literal("wikiUnit"),
      unitId: t.String(),
      labelUnitId: t.Optional(t.String()),
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      kind: t.Literal("unit"),
      unitId: t.String(),
      labelUnitId: t.Optional(t.String()),
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      kind: t.Literal("external"),
      href: t.String(),
      label: wikiZoneTranslatedLabelSchema,
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      kind: t.Literal("labelHeading"),
      labelUnitId: t.String(),
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      kind: t.Literal("manualLink"),
      href: t.String(),
      label: wikiZoneTranslatedLabelSchema,
    },
    { additionalProperties: false },
  ),
]);

export type WikiZoneNavigationItem = Static<
  typeof wikiZoneNavigationItemSchema
>;

export const wikiZoneNavigationSectionSchema = t.Object(
  {
    id: t.String(),
    labelUnitId: t.Optional(t.String()),
    label: t.Optional(wikiZoneTranslatedLabelSchema),
    items: t.Array(wikiZoneNavigationItemSchema),
  },
  { additionalProperties: false },
);

export type WikiZoneNavigationSection = Static<
  typeof wikiZoneNavigationSectionSchema
>;

export const wikiZoneNavigationSchema = t.Object(
  {
    sections: t.Array(wikiZoneNavigationSectionSchema),
  },
  { additionalProperties: false },
);

export type WikiZoneNavigation = Static<typeof wikiZoneNavigationSchema>;

export const wikiHomepageTemplateSlugSchema = t.Union([
  t.Literal("wiki-classic-home"),
  t.Literal("wiki-media-home"),
  t.Literal("wiki-database-home"),
  t.Literal("wiki-minimal-home"),
]);

export const wikiZoneTemplateSlugSchema = t.Union([
  t.Literal("wiki-classic"),
  t.Literal("wiki-media"),
  t.Literal("wiki-database"),
  t.Literal("wiki-minimal"),
]);

export const wikiZoneSortSchema = t.Union([
  t.Literal("title"),
  t.Literal("recent"),
  t.Literal("updated"),
  t.Literal("priority"),
]);

export const wikiZoneEmptyStatePolicySchema = t.Union([
  t.Literal("hide"),
  t.Literal("show-empty"),
]);

const wikiZoneSectionBaseSchema = t.Object(
  {
    id: t.String(),
    titleLabelUnitId: t.Optional(t.String()),
    title: t.Optional(wikiZoneTranslatedLabelSchema),
    limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
    emptyState: t.Optional(wikiZoneEmptyStatePolicySchema),
  },
  { additionalProperties: false },
);

export const wikiZoneHomepageSectionSchema = t.Union([
  t.Object(
    {
      ...wikiZoneSectionBaseSchema.properties,
      kind: t.Literal("entityCollection"),
      entityKinds: t.Optional(t.Array(t.String())),
      subjectRoles: t.Optional(t.Array(t.String())),
      realmUnitId: t.Optional(t.String()),
      sort: t.Optional(wikiZoneSortSchema),
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      ...wikiZoneSectionBaseSchema.properties,
      kind: t.Literal("tagCollection"),
      tagUnitIds: t.Optional(t.Array(t.String())),
      realmTagUnitIds: t.Optional(t.Array(t.String())),
      sort: t.Optional(wikiZoneSortSchema),
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      ...wikiZoneSectionBaseSchema.properties,
      kind: t.Literal("wikiUnitCollection"),
      unitIds: t.Array(t.String()),
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      ...wikiZoneSectionBaseSchema.properties,
      kind: t.Literal("recentWiki"),
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      ...wikiZoneSectionBaseSchema.properties,
      kind: t.Literal("updatedWiki"),
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      ...wikiZoneSectionBaseSchema.properties,
      kind: t.Literal("stubWiki"),
      predicate: t.Optional(
        t.Union([t.Literal("short"), t.Literal("missing-body")]),
      ),
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      ...wikiZoneSectionBaseSchema.properties,
      kind: t.Literal("manualLinks"),
      links: t.Array(wikiZoneNavigationItemSchema),
    },
    { additionalProperties: false },
  ),
]);

export type WikiZoneHomepageSection = Static<
  typeof wikiZoneHomepageSectionSchema
>;

export const wikiZoneHomepageSchema = t.Object(
  {
    template: wikiHomepageTemplateSlugSchema,
    sections: t.Array(wikiZoneHomepageSectionSchema),
  },
  { additionalProperties: false },
);

export type WikiZoneHomepage = Static<typeof wikiZoneHomepageSchema>;

export const wikiZoneThemeSchema = t.Object(
  {
    template: wikiZoneTemplateSlugSchema,
    homepageTemplate: wikiHomepageTemplateSlugSchema,
    palette: t.Optional(
      t.Object(
        {
          background: t.Optional(t.String()),
          surface: t.Optional(t.String()),
          text: t.Optional(t.String()),
          accent: t.Optional(t.String()),
        },
        { additionalProperties: false },
      ),
    ),
    media: t.Optional(
      t.Object(
        {
          logoUnitId: t.Optional(t.String()),
          bannerUnitId: t.Optional(t.String()),
          backgroundUnitId: t.Optional(t.String()),
        },
        { additionalProperties: false },
      ),
    ),
    chrome: t.Optional(
      t.Object(
        {
          density: t.Optional(
            t.Union([t.Literal("compact"), t.Literal("comfortable")]),
          ),
          navPosition: t.Optional(
            t.Union([t.Literal("side"), t.Literal("top")]),
          ),
        },
        { additionalProperties: false },
      ),
    ),
    layout: t.Optional(
      t.Object(
        {
          contentWidth: t.Optional(
            t.Union([t.Literal("normal"), t.Literal("wide")]),
          ),
          infoboxPosition: t.Optional(
            t.Union([t.Literal("right"), t.Literal("inline")]),
          ),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export type WikiZoneTheme = Static<typeof wikiZoneThemeSchema>;

export const wikiZoneConfigSchema = t.Object(
  {
    filters: wikiZoneFiltersSchema,
    navigation: t.Optional(wikiZoneNavigationSchema),
    homepage: t.Optional(wikiZoneHomepageSchema),
    theme: t.Optional(wikiZoneThemeSchema),
  },
  { additionalProperties: false },
);

export type WikiZoneConfig = Static<typeof wikiZoneConfigSchema>;

export const wikiZoneHomepageEntityItemSchema = t.Object({
  kind: t.Literal("entity"),
  entityUnitId: t.String(),
  entityKind: t.Union([t.String(), t.Null()]),
  title: t.Union([t.String(), t.Null()]),
  summary: t.Union([t.String(), t.Null()]),
});

export const wikiZoneHomepageTagItemSchema = t.Object({
  kind: t.Literal("tag"),
  tagUnitId: t.String(),
  title: t.Union([t.String(), t.Null()]),
  summary: t.Union([t.String(), t.Null()]),
});

export const wikiZoneHomepageWikiPostItemSchema = t.Object({
  kind: t.Literal("wikiPost"),
  unitId: t.String(),
  language: t.Union([languageSchema, t.Null()]),
  title: t.Union([t.String(), t.Null()]),
  summary: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export const wikiZoneHomepageNavigationItemSchema = t.Object({
  kind: t.Literal("navigationItem"),
  item: wikiZoneNavigationItemSchema,
});

export const wikiZoneHomepageItemSchema = t.Union([
  wikiZoneHomepageEntityItemSchema,
  wikiZoneHomepageTagItemSchema,
  wikiZoneHomepageWikiPostItemSchema,
  wikiZoneHomepageNavigationItemSchema,
]);

export type WikiZoneHomepageItem = Static<typeof wikiZoneHomepageItemSchema>;

export const wikiZoneHomepageSectionDataSchema = t.Object({
  section: wikiZoneHomepageSectionSchema,
  items: t.Array(wikiZoneHomepageItemSchema),
});

export type WikiZoneHomepageSectionData = Static<
  typeof wikiZoneHomepageSectionDataSchema
>;

export const wikiZoneHomepageDataSchema = t.Object({
  template: wikiHomepageTemplateSlugSchema,
  sections: t.Array(wikiZoneHomepageSectionDataSchema),
});

export type WikiZoneHomepageData = Static<typeof wikiZoneHomepageDataSchema>;

// ANCHOR: Zone DTO
// ANCHOR: 专区 DTO

export const ZoneDTOSchema = t.Object({
  unitId: t.String(),
  slug: t.String(),
  name: t.String(),
  description: t.Optional(t.Union([t.String(), t.Null()])),
  filters: ZoneFiltersSchema,
  template: t.String(),
  styling: t.Optional(t.Union([t.Object({}), t.Null()])),
  wiki: t.Optional(t.Union([wikiZoneConfigSchema, t.Null()])),
  startsAt: t.Optional(t.Union([t.String(), t.Null()])),
  endsAt: t.Optional(t.Union([t.String(), t.Null()])),
});

export type ZoneDTO = Static<typeof ZoneDTOSchema>;

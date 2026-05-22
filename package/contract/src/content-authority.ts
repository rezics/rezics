import { t } from "elysia";

export const CreationMode = {
  WIKI: "wiki",
  PERSONAL: "personal",
} as const;

export type CreationMode = (typeof CreationMode)[keyof typeof CreationMode];

export const creationModeSchema = t.Union([
  t.Literal(CreationMode.WIKI),
  t.Literal(CreationMode.PERSONAL),
]);

export const UnitAuthorityRoleKey = {
  OWNER: "owner",
  MAINTAINER: "maintainer",
  EDITOR: "editor",
  VIEWER: "viewer",
} as const;

export type UnitAuthorityRoleKey =
  (typeof UnitAuthorityRoleKey)[keyof typeof UnitAuthorityRoleKey];

export const unitAuthorityRoleKeySchema = t.Union([
  t.Literal(UnitAuthorityRoleKey.OWNER),
  t.Literal(UnitAuthorityRoleKey.MAINTAINER),
  t.Literal(UnitAuthorityRoleKey.EDITOR),
  t.Literal(UnitAuthorityRoleKey.VIEWER),
]);

export const UNIT_FIELD_LOCK_ALL = "*" as const;

export const UnitCommonFieldKey = {
  STATUS: "unit.status",
  VISIBILITY: "unit.visibility",
  RATING: "unit.rating",
  LICENSE: "unit.license",
  DEFAULT_LANGUAGE: "unit.defaultLanguage",
  LANGUAGE_NEUTRAL: "unit.isLanguageNeutral",
  WORK: "unit.work",
  EXTRA: "unit.extra",
  PUBLISHED_AT: "unit.publishedAt",
  TITLE: "identity.title",
  SUBTITLE: "identity.subtitle",
  SUMMARY: "identity.summary",
  DESCRIPTION: "identity.description",
  COVER: "identity.cover",
} as const;

export const BookFieldKey = {
  ISBN_13: "bibliographic.isbn13",
  PUBLICATION_DATE: "bibliographic.publicationDate",
  PAGE_COUNT: "bibliographic.pageCount",
  TEXT_LENGTH: "bibliographic.textLength",
  FORMAT: "bibliographic.format",
  LICENSED: "bibliographic.isLicensed",
  CONTENT_STRUCTURE: "book.contentStructure",
} as const;

export const EntityFieldKey = {
  KIND: "entity.kind",
  AVATAR: "entity.avatar",
  VERIFIED: "entity.verified",
  SLUG: "entity.slug",
  ELIGIBLE_CREDIT_ROLES: "entity.eligibleCreditRoles",
  ELIGIBLE_SUBJECT_ROLES: "entity.eligibleSubjectRoles",
} as const;

export const GameFieldKey = {
  PLATFORM: "game.platform",
  RELEASE_DATE: "game.releaseDate",
  DEVELOPER: "game.developer",
  PUBLISHER: "game.publisher",
} as const;

export const MediaFieldKey = {
  KIND: "media.kind",
  RELEASE_DATE: "media.releaseDate",
  DURATION: "media.duration",
  STUDIO: "media.studio",
} as const;

export const AttributionFieldKey = {
  CREDITS_AUTHORS: "credits.authors",
  CREDITS_PUBLISHERS: "credits.publishers",
  CREDITS_TRANSLATORS: "credits.translators",
  CREDITS_ILLUSTRATORS: "credits.illustrators",
  SUBJECTS: "subjects",
  TAGS: "tags",
} as const;

export const WikiPostFieldKey = {
  BODY: "post.body",
} as const;

export const UNIT_FIELD_KEYS = [
  ...Object.values(UnitCommonFieldKey),
  ...Object.values(BookFieldKey),
  ...Object.values(EntityFieldKey),
  ...Object.values(GameFieldKey),
  ...Object.values(MediaFieldKey),
  ...Object.values(AttributionFieldKey),
  ...Object.values(WikiPostFieldKey),
] as const;

export type UnitFieldKey = (typeof UNIT_FIELD_KEYS)[number];

export const unitFieldKeySchema = t.Union(
  UNIT_FIELD_KEYS.map((fieldKey) => t.Literal(fieldKey)) as [
    ReturnType<typeof t.Literal<UnitFieldKey>>,
    ReturnType<typeof t.Literal<UnitFieldKey>>,
    ...ReturnType<typeof t.Literal<UnitFieldKey>>[],
  ],
);

export const lockFieldKeySchema = t.Union([
  t.Literal(UNIT_FIELD_LOCK_ALL),
  unitFieldKeySchema,
]);

export type LockFieldKey = typeof UNIT_FIELD_LOCK_ALL | UnitFieldKey;

export const unitFieldLockSchema = t.Object({
  unitId: t.String(),
  fieldKey: lockFieldKeySchema,
  lockedById: t.String(),
  reason: t.Optional(t.Nullable(t.String())),
  createdAt: t.Union([t.String(), t.Date()]),
});

export type UnitFieldLockDTO = (typeof unitFieldLockSchema)["static"];

export const unitCollaboratorSchema = t.Object({
  unitId: t.String(),
  userId: t.String(),
  roleKey: unitAuthorityRoleKeySchema,
  addedById: t.String(),
  createdAt: t.Union([t.String(), t.Date()]),
});

export type UnitCollaboratorDTO = (typeof unitCollaboratorSchema)["static"];

export const unitCollaboratorListResponseSchema = t.Object({
  collaborators: t.Array(unitCollaboratorSchema),
});

export type UnitCollaboratorListResponse =
  (typeof unitCollaboratorListResponseSchema)["static"];

export const upsertUnitCollaboratorSchema = t.Object({
  userId: t.String(),
  roleKey: unitAuthorityRoleKeySchema,
});

export type UpsertUnitCollaboratorInput =
  (typeof upsertUnitCollaboratorSchema)["static"];

export const lockedFieldRejectionSchema = t.Object({
  unitId: t.String(),
  blockedFieldKeys: t.Array(lockFieldKeySchema),
  locks: t.Optional(t.Array(unitFieldLockSchema)),
});

export type LockedFieldRejection =
  (typeof lockedFieldRejectionSchema)["static"];

export const unitFieldLockListResponseSchema = t.Object({
  locks: t.Array(unitFieldLockSchema),
});

export type UnitFieldLockListResponse =
  (typeof unitFieldLockListResponseSchema)["static"];

export const createUnitFieldLockSchema = t.Object({
  fieldKey: lockFieldKeySchema,
  reason: t.Optional(t.Nullable(t.String())),
});

export type CreateUnitFieldLockInput =
  (typeof createUnitFieldLockSchema)["static"];

export const authorityErrorCodeSchema = t.Union([
  t.Literal("AUTHORITY_DENIED"),
  t.Literal("FIELD_LOCKED"),
  t.Literal("SURFACE_NOT_COLLABORATIVE"),
  t.Literal("COLLABORATOR_ROLE_DENIED"),
]);

export const authorityErrorSchema = t.Object({
  code: authorityErrorCodeSchema,
  message: t.String(),
  unitId: t.Optional(t.String()),
  blockedFieldKeys: t.Optional(t.Array(lockFieldKeySchema)),
});

export type AuthorityError = (typeof authorityErrorSchema)["static"];

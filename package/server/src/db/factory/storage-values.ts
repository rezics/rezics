export const UnitType = {
  BOOK: "BOOK",
  GAME: "GAME",
  MEDIA: "MEDIA",
  POST: "POST",
  TAG: "TAG",
  REALM: "REALM",
  SHELF: "SHELF",
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  QUOTE: "QUOTE",
  LINK: "LINK",
  ENTITY: "ENTITY",
  ZONE: "ZONE",
  USER: "USER",
  SCOPE: "SCOPE",
  SERIES: "SERIES",
  LABEL: "LABEL",
  POLL: "POLL",
  COMMENT: "COMMENT",
} as const;

export type UnitType = (typeof UnitType)[keyof typeof UnitType];

export const UnitStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
  DELETED: "DELETED",
} as const;

export type UnitStatus = (typeof UnitStatus)[keyof typeof UnitStatus];

export const UnitVisibility = {
  PUBLIC: "PUBLIC",
  UNLISTED: "UNLISTED",
  PRIVATE: "PRIVATE",
} as const;

export type UnitVisibility =
  (typeof UnitVisibility)[keyof typeof UnitVisibility];

export const PostKind = {
  REVIEW: "REVIEW",
  EXCERPT: "EXCERPT",
  REMARK: "REMARK",
  POST: "POST",
  CHAPTER: "CHAPTER",
  WIKI: "WIKI",
} as const;

export type PostKind = (typeof PostKind)[keyof typeof PostKind];

export const ContentTranslationStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;

export type ContentTranslationStatus =
  (typeof ContentTranslationStatus)[keyof typeof ContentTranslationStatus];

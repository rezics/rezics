import type { UnitFieldLockDTO } from "@rezics/contract";
import { UNIT_FIELD_LOCK_ALL } from "@rezics/contract";
import { getI18nRuntime } from "@rezics/i18n/runtime";
export type LockFieldGroup = {
  id: string;
  title: string;
  paths: readonly string[];
};

export const BOOK_LOCK_FIELD_GROUPS: readonly LockFieldGroup[] = [
  {
    id: "translations",
    title: getI18nRuntime().i18n.t("editor:authority_group_translations"),
    paths: [
      "translations.en.title",
      "translations.en.description",
      "translations.zh-Hant.title",
      "translations.zh-Hant.description",
    ],
  },
  {
    id: "metadata",
    title: getI18nRuntime().i18n.t("editor:authority_group_metadata"),
    paths: ["extension.isbn13", "extension.coverUrl"],
  },
  {
    id: "content",
    title: getI18nRuntime().i18n.t("editor:authority_group_content"),
    paths: ["post.content", "post.content.main", "post.content.main.source"],
  },
  {
    id: "credits",
    title: getI18nRuntime().i18n.t("editor:authority_group_credits"),
    paths: ["credits.authors"],
  },
];

export function lockMatchesPath(lock: UnitFieldLockDTO, path: string) {
  return lock.path === path;
}

export function editorialPathLabel(path: string) {
  if (path === UNIT_FIELD_LOCK_ALL) return getI18nRuntime().i18n.t("editor:authority_all_fields_label");

  const translationMatch = /^translations\.([^.]+)\.(.+)$/.exec(path);
  if (translationMatch) {
    const [, language, field] = translationMatch;
    const [rootField, ...leafSegments] = field.split(".");
    const rootLabel =
      rootField === "title"
        ? getI18nRuntime().i18n.t("book:fields_title")
        : rootField === "description"
          ? getI18nRuntime().i18n.t("book:description")
          : slotLabel(rootField);
    const fieldLabel =
      leafSegments.length > 0
        ? `${rootLabel} · ${leafSegments.join(".")}`
        : rootLabel;
    return `${language} ${fieldLabel}`;
  }

  const labels: Record<string, string> = {
    "extension.coverUrl": getI18nRuntime().i18n.t("book:fields_cover_url"),
    "extension.isbn13": getI18nRuntime().i18n.t("book:fields_isbn"),
    "unit.aiDisclosureMode": getI18nRuntime().i18n.t("book:fields_ai_disclosure"),
    "unit.aiDisclosureDetails": getI18nRuntime().i18n.t("book:fields_ai_disclosure"),
    "post.content": getI18nRuntime().i18n.t("editor:authority_path_post_content"),
    "post.content.main": getI18nRuntime().i18n.t("editor:authority_path_post_main"),
    "post.content.main.source": getI18nRuntime().i18n.t("editor:authority_path_post_source"),
    "credits.authors": getI18nRuntime().i18n.t("editor:authority_path_authors"),
    "entity.avatar": getI18nRuntime().i18n.t("entity:avatar_url"),
    "entity.kind": getI18nRuntime().i18n.t("editor:authority_path_entity_kind"),
    "entity.verified": getI18nRuntime().i18n.t("editor:authority_path_entity_verified"),
    "unit.slug": getI18nRuntime().i18n.t("editor:authority_path_slug"),
    "user.avatar": getI18nRuntime().i18n.t("editor:authority_path_avatar"),
    "user.bio": getI18nRuntime().i18n.t("book:author_info_bio_label"),
    "user.description": getI18nRuntime().i18n.t("common:description"),
    "user.name": getI18nRuntime().i18n.t("common:name"),
  };

  return labels[path] ?? path;
}

export function slotLabel(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}

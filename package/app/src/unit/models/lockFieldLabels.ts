import type { UnitFieldLockDTO } from "@rezics/contract";
import { UNIT_FIELD_LOCK_ALL } from "@rezics/contract";
import * as m from "@rezics/i18n/messages";

export type LockFieldGroup = {
  id: string;
  title: string;
  paths: readonly string[];
};

export const BOOK_LOCK_FIELD_GROUPS: readonly LockFieldGroup[] = [
  {
    id: "translations",
    title: m.authority_group_translations(),
    paths: [
      "translations.en.title",
      "translations.en.description",
      "translations.zh-Hant.title",
      "translations.zh-Hant.description",
    ],
  },
  {
    id: "metadata",
    title: m.authority_group_metadata(),
    paths: ["extension.isbn13", "extension.coverUrl"],
  },
  {
    id: "content",
    title: m.authority_group_content(),
    paths: ["post.content", "post.content.main", "post.content.main.source"],
  },
  {
    id: "credits",
    title: m.authority_group_credits(),
    paths: ["credits.authors"],
  },
];

export function lockMatchesPath(lock: UnitFieldLockDTO, path: string) {
  return lock.path === path;
}

export function editorialPathLabel(path: string) {
  if (path === UNIT_FIELD_LOCK_ALL) return m.authority_all_fields_label();

  const translationMatch = /^translations\.([^.]+)\.(.+)$/.exec(path);
  if (translationMatch) {
    const [, language, field] = translationMatch;
    const [rootField, ...leafSegments] = field.split(".");
    const rootLabel =
      rootField === "title"
        ? m.book_fields_title()
        : rootField === "description"
          ? m.book_description()
          : slotLabel(rootField);
    const fieldLabel =
      leafSegments.length > 0
        ? `${rootLabel} · ${leafSegments.join(".")}`
        : rootLabel;
    return `${language} ${fieldLabel}`;
  }

  const labels: Record<string, string> = {
    "extension.coverUrl": m.book_fields_cover_url(),
    "extension.isbn13": m.book_fields_isbn(),
    "post.content": m.authority_path_post_content(),
    "post.content.main": m.authority_path_post_main(),
    "post.content.main.source": m.authority_path_post_source(),
    "credits.authors": m.authority_path_authors(),
    "entity.avatar": m.entity_avatar_url(),
    "entity.kind": m.authority_path_entity_kind(),
    "entity.verified": m.authority_path_entity_verified(),
    "unit.slug": m.authority_path_slug(),
    "user.avatar": m.authority_path_avatar(),
    "user.bio": m.book_author_info_bio_label(),
    "user.description": m.common_description(),
    "user.name": m.common_name(),
  };

  return labels[path] ?? path;
}

export function slotLabel(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}

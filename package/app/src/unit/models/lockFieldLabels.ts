import type { UnitFieldLockDTO } from "@rezics/contract";
import { UNIT_FIELD_LOCK_ALL } from "@rezics/contract";
import {
  authority_all_fields_label,
  authority_group_content,
  authority_group_credits,
  authority_group_metadata,
  authority_group_translations,
  authority_path_authors,
  authority_path_avatar,
  authority_path_entity_kind,
  authority_path_entity_verified,
  authority_path_post_content,
  authority_path_post_main,
  authority_path_post_source,
  authority_path_slug,
  book_author_info_bio_label,
  book_description,
  book_fields_ai_disclosure,
  book_fields_cover_url,
  book_fields_isbn,
  book_fields_title,
  common_description,
  common_name,
  entity_avatar_url,
} from "@rezics/i18n/messages";

export type LockFieldGroup = {
  id: string;
  title: string;
  paths: readonly string[];
};

export const BOOK_LOCK_FIELD_GROUPS: readonly LockFieldGroup[] = [
  {
    id: "translations",
    title: authority_group_translations(),
    paths: [
      "translations.en.title",
      "translations.en.description",
      "translations.zh-Hant.title",
      "translations.zh-Hant.description",
    ],
  },
  {
    id: "metadata",
    title: authority_group_metadata(),
    paths: ["extension.isbn13", "extension.coverUrl"],
  },
  {
    id: "content",
    title: authority_group_content(),
    paths: ["post.content", "post.content.main", "post.content.main.source"],
  },
  {
    id: "credits",
    title: authority_group_credits(),
    paths: ["credits.authors"],
  },
];

export function lockMatchesPath(lock: UnitFieldLockDTO, path: string) {
  return lock.path === path;
}

export function editorialPathLabel(path: string) {
  if (path === UNIT_FIELD_LOCK_ALL) return authority_all_fields_label();

  const translationMatch = /^translations\.([^.]+)\.(.+)$/.exec(path);
  if (translationMatch) {
    const [, language, field] = translationMatch;
    const [rootField, ...leafSegments] = field.split(".");
    const rootLabel =
      rootField === "title"
        ? book_fields_title()
        : rootField === "description"
          ? book_description()
          : slotLabel(rootField);
    const fieldLabel =
      leafSegments.length > 0
        ? `${rootLabel} · ${leafSegments.join(".")}`
        : rootLabel;
    return `${language} ${fieldLabel}`;
  }

  const labels: Record<string, string> = {
    "extension.coverUrl": book_fields_cover_url(),
    "extension.isbn13": book_fields_isbn(),
    "unit.aiDisclosureMode": book_fields_ai_disclosure(),
    "unit.aiDisclosureDetails": book_fields_ai_disclosure(),
    "post.content": authority_path_post_content(),
    "post.content.main": authority_path_post_main(),
    "post.content.main.source": authority_path_post_source(),
    "credits.authors": authority_path_authors(),
    "entity.avatar": entity_avatar_url(),
    "entity.kind": authority_path_entity_kind(),
    "entity.verified": authority_path_entity_verified(),
    "unit.slug": authority_path_slug(),
    "user.avatar": authority_path_avatar(),
    "user.bio": book_author_info_bio_label(),
    "user.description": common_description(),
    "user.name": common_name(),
  };

  return labels[path] ?? path;
}

export function slotLabel(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}

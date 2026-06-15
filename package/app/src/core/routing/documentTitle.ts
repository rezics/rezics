import type {
  BookDTO,
  EntityDTO,
  PollDTO,
  PostDTO,
  RealmDTO,
  ShelfDTO,
  UnitDTO,
  UnitTagDTO,
  UnitTranslationDTO,
  UserDTO,
  ZoneDTO,
} from "@rezics/contract";
import type { ResolvedReadLanguageContext } from "@/shared/models/readLanguageContext";
import { getI18nRuntime } from "@rezics/i18n/runtime";

export const SITE_TITLE = "Rezics";

const TITLE_LABEL_KEYS = {
  "common:search": "common:search",
  "entity:realm_manage": "entity:realm_manage",
  "entity:realm_tab_about": "entity:realm_tab_about",
  "entity:realm_tab_members": "entity:realm_tab_members",
  "entity:realm_tab_tags": "entity:realm_tab_tags",
  "entity:realm_tab_wiki": "entity:realm_tab_wiki",
  "page:book_tabs_community": "page:book_tabs_community",
  "page:book_tabs_content": "page:book_tabs_content",
  "page:book_tabs_info": "page:book_tabs_info",
  "page:book_tabs_reviews": "page:book_tabs_reviews",
  "settings:nav_profile": "settings:nav_profile",
  "shell:navigation_realms": "shell:navigation_realms",
  "shell:navigation_zones": "shell:navigation_zones",
  "zone:create_post": "zone:create_post",
  "zone:manage": "zone:manage",
} as const satisfies Record<string, `${string}:${string}`>;

export type TitleLabelKey = keyof typeof TITLE_LABEL_KEYS;

export function titleLabel(
  key: TitleLabelKey,
  options?: Record<string, unknown>,
) {
  return getI18nRuntime().i18n.t(TITLE_LABEL_KEYS[key], options);
}

export function documentTitle(
  parts: readonly (string | null | undefined)[],
): string {
  const normalizedParts = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  if (normalizedParts.at(-1) !== SITE_TITLE) normalizedParts.push(SITE_TITLE);
  return normalizedParts.join(" | ");
}

export function titleMeta(...parts: (string | null | undefined)[]) {
  return {
    meta: [{ title: documentTitle(parts) }],
  };
}

function firstNonEmpty(...values: (string | null | undefined)[]) {
  return values.find((value) => value?.trim())?.trim() ?? null;
}

function titleFromTranslations(
  translations: readonly UnitTranslationDTO[] | undefined,
  readContext?: ResolvedReadLanguageContext,
): string | null {
  if (!translations?.length) return null;
  const byLanguage = new Map(
    translations.map((translation) => [translation.language, translation]),
  );
  const orderedLanguages = [
    readContext?.appLocale,
    ...(readContext?.languages ?? []),
  ];
  for (const language of orderedLanguages) {
    if (!language) continue;
    const title = byLanguage.get(language)?.title;
    if (title?.trim()) return title.trim();
  }
  return (
    translations
      .find((translation) => translation.title?.trim())
      ?.title?.trim() ?? null
  );
}

export function titleOfTranslatedUnit(
  unit:
    | Pick<UnitDTO, "title" | "translations" | "slug" | "id">
    | Pick<BookDTO, "title" | "translations" | "unitId">
    | Pick<RealmDTO, "title" | "translations" | "slug" | "unitId">
    | Pick<ShelfDTO, "title" | "translations" | "slug" | "unitId">,
  readContext?: ResolvedReadLanguageContext,
  fallback?: string,
): string {
  return (
    firstNonEmpty(
      "title" in unit ? unit.title : null,
      titleFromTranslations(unit.translations, readContext),
      "slug" in unit ? unit.slug : null,
      fallback,
      "unitId" in unit ? unit.unitId : null,
      "id" in unit ? unit.id : null,
    ) ?? SITE_TITLE
  );
}

export function titleOfBook(
  book: Pick<BookDTO, "title" | "translations" | "unitId">,
  readContext?: ResolvedReadLanguageContext,
) {
  return titleOfTranslatedUnit(book, readContext, book.unitId);
}

export function titleOfRealm(
  realm: Pick<RealmDTO, "title" | "translations" | "slug" | "unitId">,
  readContext?: ResolvedReadLanguageContext,
) {
  return titleOfTranslatedUnit(realm, readContext, realm.slug ?? realm.unitId);
}

export function titleOfZone(zone: Pick<ZoneDTO, "name" | "slug" | "unitId">) {
  return firstNonEmpty(zone.name, zone.slug, zone.unitId) ?? SITE_TITLE;
}

export function titleOfPost(post: Pick<PostDTO, "title" | "unitId">) {
  return firstNonEmpty(post.title, post.unitId) ?? SITE_TITLE;
}

export function titleOfShelf(
  shelf: Pick<ShelfDTO, "title" | "translations" | "slug" | "unitId">,
  readContext?: ResolvedReadLanguageContext,
) {
  return titleOfTranslatedUnit(shelf, readContext, shelf.slug ?? shelf.unitId);
}

export function titleOfTag(
  tag: UnitTagDTO &
    Partial<{
      title: string | null;
      name: string | null;
      label: string | null;
    }>,
) {
  return (
    firstNonEmpty(tag.title, tag.name, tag.label, tag.tagUnitId) ?? SITE_TITLE
  );
}

export function titleOfEntity(
  entity: Pick<EntityDTO, "translations" | "slug" | "unitId">,
  readContext?: ResolvedReadLanguageContext,
) {
  return (
    titleFromTranslations(entity.translations, readContext) ??
    firstNonEmpty(entity.slug, entity.unitId) ??
    SITE_TITLE
  );
}

export function titleOfUser(user: Pick<UserDTO, "name" | "slug" | "unitId">) {
  return firstNonEmpty(user.name, user.slug, user.unitId) ?? SITE_TITLE;
}

export function titleOfPoll(
  poll: Pick<PollDTO, "title"> & {
    unitId?: string | null;
    pollUnitId?: string | null;
  },
) {
  return firstNonEmpty(poll.title, poll.unitId, poll.pollUnitId) ?? SITE_TITLE;
}

export function loaderDataByRouteId<T>(
  matches: readonly { routeId: string; loaderData?: unknown }[],
  routeId: string,
): T | null {
  return (
    (matches.find((match) => match.routeId === routeId)?.loaderData as
      | T
      | undefined) ?? null
  );
}

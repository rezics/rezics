import type {
  CommentSearchDocument,
  ContentSearchDocument,
  EntitySearchDocument,
  FederatedSingleItem,
  PostSearchDocument,
  RealmSearchDocument,
  SearchCategory,
  ShelfItemShelfGroup,
  UserSearchDocument,
  ZoneSearchDocument,
} from "@rezics/contract";
import { contentDocMarkdownFallback } from "@rezics/contract";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import { Badge } from "@rezics/ui/shadcn";
import type React from "react";
import { SearchContentResultCard, SearchLibraryUnitCard } from "@/components";
import { unitHref } from "@/shared/ui/link";
import { contentHref } from "../models/contentDestination";
import { shelfMatchedSource } from "../models/shelfMatchedSource";

type ContentCategory = "books" | "shelves";
type PostCategory = "reviews" | "excerpts" | "remarks" | "posts";
type CardBadge = React.ReactNode;
type ShelfSearchDocument = ContentSearchDocument & {
  matchedShelfItemGroup?: ShelfItemShelfGroup;
};

export function pickSearchTitle(
  titles: readonly string[] | null | undefined,
): string {
  if (!titles || titles.length === 0) return "";
  return titles[0] ?? "";
}

export function resolveContentSearchTitle(
  item: ContentSearchDocument,
  preferredLanguage?: string,
): string {
  if (preferredLanguage) {
    const idx = item.languages.indexOf(preferredLanguage);
    if (idx >= 0 && item.titles[idx]) return item.titles[idx] ?? "";
  }
  return pickSearchTitle(item.titles);
}

export function isContentSearchCategory(
  category: SearchCategory,
): category is ContentCategory {
  return category === "books" || category === "shelves";
}

export function isPostSearchCategory(
  category: SearchCategory,
): category is PostCategory {
  return (
    category === "reviews" ||
    category === "excerpts" ||
    category === "remarks" ||
    category === "posts"
  );
}

function firstText(
  ...values: Array<readonly string[] | string | null | undefined>
): string {
  for (const value of values) {
    if (Array.isArray(value)) {
      const found = value.find((entry) => entry.trim() !== "");
      if (found) return found;
      continue;
    }
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return "";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString();
}

function compactParts(
  parts: Array<React.ReactNode | null | undefined | false>,
): React.ReactNode {
  return parts.filter(Boolean).map((part, index) => (
    <span key={typeof part === "string" ? part : `part-${String(part)}`}>
      {index > 0 ? " · " : null}
      {part}
    </span>
  ));
}

function targetHref(item: PostSearchDocument): string | undefined {
  if (!item.targetUnitId) return undefined;
  if (item.targetType === "BOOK") return `/book/${item.targetUnitId}`;
  if (item.targetType === "SHELF") return `/shelf/${item.targetUnitId}`;
  if (item.targetType === "REALM") return `/realm/${item.targetUnitId}`;
  return `/unit/${item.targetUnitId}`;
}

function postMeta(item: PostSearchDocument): React.ReactNode {
  return compactParts([
    item.scoreValue !== null ? item.scoreValue : null,
    item.replyCount > 0
      ? `${item.replyCount} ${getI18nRuntime().i18n.t("common:reply")}`
      : null,
    formatDate(item.updatedAt),
  ]);
}

function profileMeta(count: number | null | undefined) {
  return count == null
    ? undefined
    : getI18nRuntime().i18n.t("settings:profile_followers_count", { count });
}

export function renderContentSearchCard(
  item: ContentSearchDocument,
  options: {
    badge?: CardBadge;
    preferredLanguage?: string;
  } = {},
) {
  const title =
    item.resolvedLanguage !== undefined
      ? (item.title ?? item.id)
      : resolveContentSearchTitle(item, options.preferredLanguage) || item.id;
  const summary =
    item.resolvedLanguage !== undefined
      ? firstText(item.summary, contentDocMarkdownFallback(item.description))
      : firstText(
          item.summaries,
          item.descriptionText,
          item.descriptions,
          item.contentText,
        );
  const subtitle = firstText(
    item.resolvedLanguage !== undefined ? item.subtitle : item.subtitles,
    item.creditNames.length > 0 ? item.creditNames.join(" · ") : null,
    item.linkSiteName,
  );
  const meta = compactParts([
    item.type,
    item.defaultLanguage,
    formatDate(item.publishedAt ?? item.updatedAt),
  ]);
  const href = contentHref(item);
  const source =
    item.type === "SHELF"
      ? (shelfMatchedSource(
          (item as ShelfSearchDocument).matchedShelfItemGroup,
        ) ?? subtitle)
      : subtitle;

  if (item.type === "BOOK") {
    return (
      <SearchLibraryUnitCard
        title={title}
        titleHref={href}
        subtitle={subtitle || undefined}
        description={summary || undefined}
        meta={meta}
        badge={options.badge}
        image={{
          src: item.coverUrl,
          alt: getI18nRuntime().i18n.t("book:title"),
        }}
      />
    );
  }

  return (
    <SearchContentResultCard
      badge={options.badge}
      kind={item.type}
      source={source || undefined}
      title={title}
      titleHref={href}
      body={summary || undefined}
      meta={meta}
      thumbnail={
        item.coverUrl
          ? { src: item.coverUrl, alt: getI18nRuntime().i18n.t("book:title") }
          : undefined
      }
    />
  );
}

export function renderPostSearchCard(
  item: PostSearchDocument,
  badge?: CardBadge,
) {
  const targetTitle = pickSearchTitle(item.targetTitles);
  const body =
    item.resolvedLanguage !== undefined
      ? contentDocMarkdownFallback(item.content)
      : item.contentText;
  return (
    <SearchContentResultCard
      user={{
        unitId: item.authorUserId,
        name: item.authorName,
        slug: item.authorSlug,
        avatar: item.authorAvatar,
      }}
      time={formatDate(item.updatedAt)}
      kind={badge ?? item.kind ?? getI18nRuntime().i18n.t("search:origin_post")}
      title={item.title ?? undefined}
      source={targetTitle || undefined}
      sourceHref={targetHref(item)}
      body={body || undefined}
      meta={postMeta(item)}
      thumbnail={
        item.targetCoverUrl
          ? { src: item.targetCoverUrl, alt: targetTitle }
          : undefined
      }
      bodyLines={3}
    />
  );
}

function commentHref(item: CommentSearchDocument): string {
  return `/post/${item.rootUnitId}/continue/${item.id}`;
}

function commentMeta(item: CommentSearchDocument): React.ReactNode {
  return compactParts([
    item.replyCount > 0
      ? `${item.replyCount} ${getI18nRuntime().i18n.t("common:reply")}`
      : null,
    formatDate(item.updatedAt),
  ]);
}

export function renderCommentSearchCard(
  item: CommentSearchDocument,
  badge?: CardBadge,
) {
  return (
    <SearchContentResultCard
      user={{
        unitId: item.authorUserId,
        name: item.authorName,
        slug: item.authorSlug,
        avatar: item.authorAvatar,
      }}
      time={formatDate(item.updatedAt)}
      kind={badge ?? getI18nRuntime().i18n.t("search:origin_comment")}
      title={getI18nRuntime().i18n.t("search:origin_comment")}
      titleHref={commentHref(item)}
      body={item.contentText ?? undefined}
      meta={commentMeta(item)}
      bodyLines={3}
    />
  );
}

export function renderRealmSearchCard(
  item: RealmSearchDocument,
  badge?: CardBadge,
) {
  const title =
    item.resolvedLanguage !== undefined
      ? (item.title ?? item.id)
      : pickSearchTitle(item.titles) || item.id;
  const description =
    item.resolvedLanguage !== undefined
      ? (item.description ?? "")
      : firstText(
          item.translations.map((translation) => translation.description ?? ""),
          item.descriptions,
        );

  return (
    <SearchContentResultCard
      kind={badge ?? getI18nRuntime().i18n.t("search:origin_realm")}
      title={title}
      titleHref={unitHref({ type: "REALM", unitId: item.id, slug: null })}
      body={description || undefined}
      meta={getI18nRuntime().i18n.t("search:realm_members", {
        count: item.memberCount,
      })}
    />
  );
}

export function renderZoneSearchCard(
  item: ZoneSearchDocument,
  badge?: CardBadge,
) {
  const title =
    item.resolvedLanguage !== undefined
      ? (item.title ?? item.id)
      : pickSearchTitle(item.titles) || item.id;
  const description =
    item.resolvedLanguage !== undefined
      ? (item.description ?? "")
      : firstText(
          item.translations.map((translation) => translation.description ?? ""),
          item.descriptions,
        );
  const ownerRealm = firstText(item.ownerRealmTitles);

  return (
    <SearchContentResultCard
      kind={badge ?? getI18nRuntime().i18n.t("search:origin_zone")}
      title={title}
      titleHref={unitHref({ type: "ZONE", unitId: item.id, slug: item.slug })}
      body={description || undefined}
      meta={compactParts([
        ownerRealm
          ? getI18nRuntime().i18n.t("search:zone_owner_realm", {
              realm: ownerRealm,
            })
          : null,
        formatDate(item.updatedAt),
      ])}
    />
  );
}

export function renderUserSearchCard(
  item: UserSearchDocument,
  badge?: CardBadge,
) {
  return (
    <SearchContentResultCard
      user={{
        unitId: item.unitId,
        name: item.name,
        slug: item.slug,
        avatar: item.avatar,
        summary: item.summary,
        description: item.descriptionText,
        followersCount: item.followersCount,
        followingsCount: item.followingsCount,
      }}
      kind={badge ?? getI18nRuntime().i18n.t("search:origin_user")}
      body={item.summary ?? item.descriptionText ?? undefined}
      meta={profileMeta(item.followersCount)}
    />
  );
}

export function renderEntitySearchCard(
  item: EntitySearchDocument,
  badge?: CardBadge,
) {
  const title = pickSearchTitle(item.titles) || item.id;
  const summary = firstText(
    item.translations.map((translation) => translation.summary ?? ""),
    item.summaries,
  );

  return (
    <SearchContentResultCard
      kind={
        badge ?? item.kind ?? getI18nRuntime().i18n.t("search:origin_entity")
      }
      avatar={{
        src: item.avatar,
        alt: getI18nRuntime().i18n.t("book:title"),
        fallback: title.slice(0, 1).toUpperCase(),
      }}
      title={title}
      titleHref={unitHref({
        type: "ENTITY",
        unitId: item.unitId,
        slug: item.slug,
      })}
      body={summary || undefined}
      meta={compactParts([
        item.kind,
        item.verified ? getI18nRuntime().i18n.t("entity:verified") : null,
      ])}
    />
  );
}

export function originBadge(label: string): React.ReactNode {
  return <Badge variant="secondary">{label}</Badge>;
}

export function renderFederatedSearchCard(
  category: SearchCategory,
  item: FederatedSingleItem,
  badge?: CardBadge,
) {
  if (isContentSearchCategory(category)) {
    return renderContentSearchCard(item as ContentSearchDocument, { badge });
  }
  if (isPostSearchCategory(category)) {
    return renderPostSearchCard(item as PostSearchDocument, badge);
  }
  if (category === "comments") {
    return renderCommentSearchCard(item as CommentSearchDocument, badge);
  }
  if (category === "realms") {
    return renderRealmSearchCard(item as RealmSearchDocument, badge);
  }
  if (category === "zones") {
    return renderZoneSearchCard(item as ZoneSearchDocument, badge);
  }
  if (category === "users") {
    return renderUserSearchCard(item as UserSearchDocument, badge);
  }
  if (category === "entities") {
    return renderEntitySearchCard(item as EntitySearchDocument, badge);
  }
  return null;
}

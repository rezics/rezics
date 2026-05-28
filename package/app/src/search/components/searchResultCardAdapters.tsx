import type {
  ContentSearchDocument,
  EntitySearchDocument,
  FederatedSingleItem,
  PostSearchDocument,
  RealmSearchDocument,
  SearchCategory,
  UserSearchDocument,
} from "@rezics/contract";
import { Badge } from "@rezics/ui/shadcn";
import type React from "react";
import {
  SearchContentResultCard,
  SearchLibraryUnitCard,
} from "@/components/card";
import { contentHref } from "../models/contentDestination";
import { unitHref } from "@/shared/ui/link";

import { getI18nRuntime } from "@rezics/i18n/runtime";
type ContentCategory = "books" | "shelves";
type PostCategory = "reviews" | "excerpts" | "remarks" | "posts";
type CardBadge = React.ReactNode;

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
    if (value && value.trim() !== "") return value;
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
    <span key={`${index}`}>
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
    item.replyCount > 0 ? `${item.replyCount} ${getI18nRuntime().i18n.t("common:reply")}` : null,
    formatDate(item.updatedAt),
  ]);
}

function profileMeta(count: number | null | undefined) {
  return count == null ? undefined : getI18nRuntime().i18n.t("settings:profile_followers_count", { count });
}

export function renderContentSearchCard(
  item: ContentSearchDocument,
  options: {
    badge?: CardBadge;
    preferredLanguage?: string;
  } = {},
) {
  const title =
    resolveContentSearchTitle(item, options.preferredLanguage) || item.id;
  const summary = firstText(
    item.summaries,
    item.descriptionText,
    item.descriptions,
    item.contentText,
  );
  const subtitle = firstText(
    item.subtitles,
    item.creditNames.length > 0 ? item.creditNames.join(" · ") : null,
    item.linkSiteName,
  );
  const meta = compactParts([
    item.type,
    item.defaultLanguage,
    formatDate(item.publishedAt ?? item.updatedAt),
  ]);
  const href = contentHref(item);

  if (item.type === "BOOK") {
    return (
      <SearchLibraryUnitCard
        title={title}
        titleHref={href}
        subtitle={subtitle || undefined}
        description={summary || undefined}
        meta={meta}
        badge={options.badge}
        image={{ src: item.coverUrl, alt: title }}
      />
    );
  }

  return (
    <SearchContentResultCard
      badge={options.badge}
      kind={item.type}
      source={subtitle || undefined}
      title={title}
      titleHref={href}
      body={summary || undefined}
      meta={meta}
      thumbnail={item.coverUrl ? { src: item.coverUrl, alt: title } : undefined}
    />
  );
}

export function renderPostSearchCard(
  item: PostSearchDocument,
  badge?: CardBadge,
) {
  const targetTitle = pickSearchTitle(item.targetTitles);
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
      source={targetTitle || undefined}
      sourceHref={targetHref(item)}
      body={item.contentText ?? undefined}
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

export function renderRealmSearchCard(
  item: RealmSearchDocument,
  badge?: CardBadge,
) {
  const title = pickSearchTitle(item.titles) || item.id;
  const description = firstText(
    item.translations.map((translation) => translation.description ?? ""),
    item.descriptions,
  );

  return (
    <SearchContentResultCard
      kind={badge ?? getI18nRuntime().i18n.t("search:origin_realm")}
      title={title}
      titleHref={unitHref({ type: "REALM", unitId: item.id, slug: null })}
      body={description || undefined}
      meta={getI18nRuntime().i18n.t("search:realm_members", { count: item.memberCount })}
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
        bio: item.bio,
        description: item.descriptionText,
        followersCount: item.followersCount,
        followingsCount: item.followingsCount,
      }}
      kind={badge ?? getI18nRuntime().i18n.t("search:origin_user")}
      body={item.bio ?? item.descriptionText ?? undefined}
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
      kind={badge ?? item.kind ?? getI18nRuntime().i18n.t("search:origin_entity")}
      avatar={{
        src: item.avatar,
        alt: title,
        fallback: title.slice(0, 1).toUpperCase(),
      }}
      title={title}
      titleHref={unitHref({
        type: "ENTITY",
        unitId: item.unitId,
        slug: item.slug,
      })}
      body={summary || undefined}
      meta={compactParts([item.kind, item.verified ? getI18nRuntime().i18n.t("entity:verified") : null])}
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
  if (category === "realms") {
    return renderRealmSearchCard(item as RealmSearchDocument, badge);
  }
  if (category === "users") {
    return renderUserSearchCard(item as UserSearchDocument, badge);
  }
  if (category === "entities") {
    return renderEntitySearchCard(item as EntitySearchDocument, badge);
  }
  return null;
}

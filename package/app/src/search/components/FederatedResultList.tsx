import type {
  ContentSearchDocument,
  FederatedRankedHit,
  FederatedSearchResult,
  FederatedSingleItem,
  PostSearchDocument,
  SearchCategory,
  SearchScope,
} from "@rezics/contract";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import { EmptyState } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import type React from "react";
import { CATEGORY_LABELS } from "./permittedCategories";
import {
  renderFederatedSearchCard,
  originBadge as renderOriginBadge,
} from "./searchResultCardAdapters";

type ContentRowCategory = "books" | "shelves";
type PostRowCategory = "reviews" | "excerpts" | "remarks" | "posts";
type CommentRowCategory = "comments";
type RealmRowCategory = "realms";
type UserRowCategory = "users";
type EntityRowCategory = "entities";
type ItemRowCategory =
  | ContentRowCategory
  | PostRowCategory
  | CommentRowCategory
  | RealmRowCategory
  | UserRowCategory
  | EntityRowCategory;

export type FederatedResultListProps = {
  result?: FederatedSearchResult;
  isLoading: boolean;
  scope: SearchScope;
  onCategoryChange: (next: SearchCategory) => void;
};

export const FederatedResultList: React.FC<FederatedResultListProps> = ({
  result,
  isLoading,
  onCategoryChange,
}) => {
  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <p className="text-text-secondary">
          {getI18nRuntime().i18n.t("common:loading")}
        </p>
      </div>
    );
  }

  if (!result) {
    return <EmptyState title={getI18nRuntime().i18n.t("search:empty_title")} />;
  }

  if (result.kind === "grouped") {
    const sectionEntries: Array<
      [ItemRowCategory, { totalHits: number; items: unknown[] }]
    > = [];
    const s = result.sections;
    if (s.books) sectionEntries.push(["books", s.books]);
    if (s.reviews) sectionEntries.push(["reviews", s.reviews]);
    if (s.excerpts) sectionEntries.push(["excerpts", s.excerpts]);
    if (s.remarks) sectionEntries.push(["remarks", s.remarks]);
    if (s.posts) sectionEntries.push(["posts", s.posts]);
    if (s.shelves) sectionEntries.push(["shelves", s.shelves]);
    if (s.realms) sectionEntries.push(["realms", s.realms]);
    if (s.users) sectionEntries.push(["users", s.users]);
    if (s.entities) sectionEntries.push(["entities", s.entities]);

    const visible = sectionEntries.filter(([, sec]) => sec.totalHits > 0);
    if (visible.length === 0) {
      return (
        <EmptyState title={getI18nRuntime().i18n.t("search:empty_title")} />
      );
    }

    return (
      <div className="space-y-8">
        {visible.map(([category, section]) => (
          <section key={category}>
            <header className="flex items-baseline justify-between mb-2">
              <h2 className="text-lg font-semibold">
                {CATEGORY_LABELS[category]()}{" "}
                <span className="text-sm text-text-secondary">
                  ({section.totalHits})
                </span>
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCategoryChange(category)}
              >
                {getI18nRuntime().i18n.t("common:view_more")}
              </Button>
            </header>
            <div className="space-y-2">
              {section.items.map((item, idx) => (
                <div key={(item as { id?: string }).id ?? idx}>
                  {renderSingleItem(category, item as FederatedSingleItem)}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  if (result.kind === "ranked") {
    if (result.hits.length === 0) {
      return (
        <EmptyState title={getI18nRuntime().i18n.t("search:empty_title")} />
      );
    }
    return (
      <div>
        <p className="mb-2 text-xs text-text-secondary">
          {getI18nRuntime().i18n.t("search:results_summary", {
            count: result.totalHits,
            ms: result.processingTimeMs,
          })}
        </p>
        <div className="space-y-2">
          {result.hits.map((hit, idx) => (
            <RankedHitCard key={(hit as { id?: string }).id ?? idx} hit={hit} />
          ))}
        </div>
      </div>
    );
  }

  // single
  // single（单一类别结果）
  if (result.items.length === 0) {
    return <EmptyState title={getI18nRuntime().i18n.t("search:empty_title")} />;
  }
  return (
    <div>
      <p className="mb-2 text-xs text-text-secondary">
        {getI18nRuntime().i18n.t("search:results_summary", {
          count: result.totalHits,
          ms: result.processingTimeMs,
        })}
      </p>
      <div className="space-y-2">
        {result.items.map((item, idx) => (
          <div key={(item as { id?: string }).id ?? idx}>
            {renderSingleItem(result.category, item)}
          </div>
        ))}
      </div>
    </div>
  );
};

function originBadge(hit: FederatedRankedHit): string {
  const origin = hit._origin;
  if (origin.indexUid === "content") {
    const doc = hit as ContentSearchDocument & { _origin: typeof origin };
    return doc.type === "SHELF"
      ? getI18nRuntime().i18n.t("search:category_shelves")
      : getI18nRuntime().i18n.t("search:origin_book");
  }
  if (origin.indexUid === "post") {
    const doc = hit as PostSearchDocument & { _origin: typeof origin };
    return doc.kind ?? getI18nRuntime().i18n.t("search:origin_post");
  }
  if (origin.indexUid === "comments") {
    return getI18nRuntime().i18n.t("search:origin_comment");
  }
  if (origin.indexUid === "realm")
    return getI18nRuntime().i18n.t("search:origin_realm");
  if (origin.indexUid === "user")
    return getI18nRuntime().i18n.t("search:origin_user");
  if (origin.indexUid === "entities")
    return getI18nRuntime().i18n.t("search:origin_entity");
  return origin.indexUid;
}

function RankedHitCard({ hit }: { hit: FederatedRankedHit }) {
  const badge = originBadge(hit);
  return renderFederatedSearchCard(
    hit._origin.category,
    hit,
    renderOriginBadge(badge),
  );
}

function renderSingleItem(category: SearchCategory, item: FederatedSingleItem) {
  return renderFederatedSearchCard(category, item);
}

import type {
  ContentSearchDocument,
  FederatedRankedHit,
  FederatedSearchResult,
  FederatedSingleItem,
  PostSearchDocument,
  SearchCategory,
  SearchScope,
} from "@rezics/contract";
import {
  common_loading,
  common_view_more,
  search_category_shelves,
  search_empty_title,
  search_origin_book,
  search_origin_entity,
  search_origin_post,
  search_origin_realm,
  search_origin_user,
  search_results_summary,
} from "@rezics/i18n/messages";
import { EmptyState } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import type React from "react";
import { CATEGORY_LABELS } from "./permittedCategories";
import {
  originBadge as renderOriginBadge,
  renderFederatedSearchCard,
} from "./searchResultCardAdapters";

type ContentRowCategory = "books" | "shelves";
type PostRowCategory = "reviews" | "excerpts" | "remarks" | "posts";
type RealmRowCategory = "realms";
type UserRowCategory = "users";
type EntityRowCategory = "entities";
type ItemRowCategory =
  | ContentRowCategory
  | PostRowCategory
  | RealmRowCategory
  | UserRowCategory
  | EntityRowCategory;

function originBadge(hit: FederatedRankedHit): string {
  const origin = hit._origin;
  if (origin.indexUid === "content") {
    const doc = hit as ContentSearchDocument & { _origin: typeof origin };
    return doc.type === "SHELF"
      ? search_category_shelves()
      : search_origin_book();
  }
  if (origin.indexUid === "post") {
    const doc = hit as PostSearchDocument & { _origin: typeof origin };
    return doc.kind ?? search_origin_post();
  }
  if (origin.indexUid === "realm") return search_origin_realm();
  if (origin.indexUid === "user") return search_origin_user();
  if (origin.indexUid === "entities") return search_origin_entity();
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
        <p className="text-text-secondary">{common_loading()}</p>
      </div>
    );
  }

  if (!result) {
    return <EmptyState title={search_empty_title()} />;
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
      return <EmptyState title={search_empty_title()} />;
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
                {common_view_more()}
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
      return <EmptyState title={search_empty_title()} />;
    }
    return (
      <div>
        <p className="mb-2 text-xs text-text-secondary">
          {search_results_summary({
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
  if (result.items.length === 0) {
    return <EmptyState title={search_empty_title()} />;
  }
  return (
    <div>
      <p className="mb-2 text-xs text-text-secondary">
        {search_results_summary({
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

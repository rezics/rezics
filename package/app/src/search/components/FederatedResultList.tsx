import type {
  ContentSearchDocument,
  FederatedRankedHit,
  FederatedSearchResult,
  FederatedSingleItem,
  PostSearchDocument,
  RealmSearchDocument,
  SearchCategory,
  SearchScope,
  UserSearchDocument,
} from "@rezics/contract";
import { PostKind } from "@rezics/contract";
import { EmptyState } from "@rezics/ui";
import { Badge, Button } from "@rezics/ui/shadcn";
import type React from "react";
import { useTranslation } from "react-i18next";
import { ReviewCard } from "@/review/components/item/ReviewCard";
import { mapPostSearchDocToPostDTO } from "@/review/models/postSearchDocToPostDTO";

const CATEGORY_TITLES: Record<SearchCategory, string> = {
  all: "All",
  mixed: "Mixed",
  books: "Books",
  reviews: "Reviews",
  excerpts: "Excerpts",
  remarks: "Remarks",
  posts: "Posts",
  shelves: "Shelves",
  realms: "Realms",
  users: "Users",
};

function pickTitle(titles: readonly string[] | null | undefined): string {
  if (!titles || titles.length === 0) return "";
  return titles[0] ?? "";
}

function ContentItemRow({ item }: { item: ContentSearchDocument }) {
  const title = pickTitle(item.titles);
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border-whisper last:border-b-0">
      {item.coverUrl && (
        <img
          src={item.coverUrl}
          alt={title}
          className="w-16 h-20 object-cover rounded"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title || item.id}</p>
        <p className="text-xs text-text-secondary">{item.type}</p>
        {item.summaries[0] && (
          <p className="text-sm text-text-secondary line-clamp-2 mt-1">
            {item.summaries[0]}
          </p>
        )}
      </div>
    </div>
  );
}

function PostItemRow({ item }: { item: PostSearchDocument }) {
  if (item.kind === PostKind.REVIEW) {
    return (
      <ReviewCard
        review={mapPostSearchDocToPostDTO(item)}
        className="border-b-0 py-0"
      />
    );
  }

  return (
    <div className="py-3 border-b border-border-whisper last:border-b-0">
      <p className="text-xs text-text-secondary">
        {item.kind ?? "POST"} · {item.authorName ?? item.authorUserId}
      </p>
      {item.body && <p className="text-sm line-clamp-3 mt-1">{item.body}</p>}
    </div>
  );
}

function RealmItemRow({ item }: { item: RealmSearchDocument }) {
  const title = pickTitle(item.titles);
  return (
    <div className="py-3 border-b border-border-whisper last:border-b-0">
      <p className="text-sm font-medium truncate">{title || item.id}</p>
      <p className="text-xs text-text-secondary">{item.memberCount} members</p>
    </div>
  );
}

function UserItemRow({ item }: { item: UserSearchDocument }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border-whisper last:border-b-0">
      {item.avatar && (
        <img
          src={item.avatar}
          alt={item.name}
          className="w-10 h-10 rounded-full"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        {item.bio && (
          <p className="text-xs text-text-secondary line-clamp-2">{item.bio}</p>
        )}
      </div>
    </div>
  );
}

type ContentRowCategory = "books" | "shelves";
type PostRowCategory = "reviews" | "excerpts" | "remarks" | "posts";
type RealmRowCategory = "realms";
type UserRowCategory = "users";
type ItemRowCategory =
  | ContentRowCategory
  | PostRowCategory
  | RealmRowCategory
  | UserRowCategory;

function isContentSection(
  category: SearchCategory,
): category is ContentRowCategory {
  return category === "books" || category === "shelves";
}

function isPostSection(category: SearchCategory): category is PostRowCategory {
  return (
    category === "reviews" ||
    category === "excerpts" ||
    category === "remarks" ||
    category === "posts"
  );
}

function originBadge(hit: FederatedRankedHit): string {
  const origin = hit._origin;
  if (origin.indexUid === "content") {
    const doc = hit as ContentSearchDocument & { _origin: typeof origin };
    return doc.type === "SHELF" ? "Shelf" : "Book";
  }
  if (origin.indexUid === "post") {
    const doc = hit as PostSearchDocument & { _origin: typeof origin };
    return doc.kind ?? "Post";
  }
  if (origin.indexUid === "realm") return "Realm";
  if (origin.indexUid === "user") return "User";
  return origin.indexUid;
}

function RankedHitRow({ hit }: { hit: FederatedRankedHit }) {
  const badge = originBadge(hit);
  const indexUid = hit._origin.indexUid;
  return (
    <div className="py-3 border-b border-border-whisper last:border-b-0">
      <Badge className="mb-1">{badge}</Badge>
      {indexUid === "content" && (
        <ContentItemRow item={hit as ContentSearchDocument} />
      )}
      {indexUid === "post" && <PostItemRow item={hit as PostSearchDocument} />}
      {indexUid === "realm" && (
        <RealmItemRow item={hit as RealmSearchDocument} />
      )}
      {indexUid === "user" && <UserItemRow item={hit as UserSearchDocument} />}
    </div>
  );
}

function renderSingleItem(category: SearchCategory, item: FederatedSingleItem) {
  if (isContentSection(category)) {
    return <ContentItemRow item={item as ContentSearchDocument} />;
  }
  if (isPostSection(category)) {
    return <PostItemRow item={item as PostSearchDocument} />;
  }
  if (category === "realms") {
    return <RealmItemRow item={item as RealmSearchDocument} />;
  }
  if (category === "users") {
    return <UserItemRow item={item as UserSearchDocument} />;
  }
  return null;
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
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <p className="text-text-secondary">{t("common.loading")}</p>
      </div>
    );
  }

  if (!result) {
    return <EmptyState title={t("search.empty.title")} />;
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

    const visible = sectionEntries.filter(([, sec]) => sec.totalHits > 0);
    if (visible.length === 0) {
      return <EmptyState title={t("search.empty.title")} />;
    }

    return (
      <div className="space-y-8">
        {visible.map(([category, section]) => (
          <section key={category}>
            <header className="flex items-baseline justify-between mb-2">
              <h2 className="text-lg font-semibold">
                {CATEGORY_TITLES[category]}{" "}
                <span className="text-sm text-text-secondary">
                  ({section.totalHits})
                </span>
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCategoryChange(category)}
              >
                查看更多
              </Button>
            </header>
            <div>
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
      return <EmptyState title={t("search.empty.title")} />;
    }
    return (
      <div>
        <p className="mb-2 text-xs text-text-secondary">
          {result.totalHits} results ({result.processingTimeMs}ms)
        </p>
        <div>
          {result.hits.map((hit, idx) => (
            <RankedHitRow key={(hit as { id?: string }).id ?? idx} hit={hit} />
          ))}
        </div>
      </div>
    );
  }

  // single
  if (result.items.length === 0) {
    return <EmptyState title={t("search.empty.title")} />;
  }
  return (
    <div>
      <p className="mb-2 text-xs text-text-secondary">
        {result.totalHits} results ({result.processingTimeMs}ms)
      </p>
      <div>
        {result.items.map((item, idx) => (
          <div key={(item as { id?: string }).id ?? idx}>
            {renderSingleItem(result.category, item)}
          </div>
        ))}
      </div>
    </div>
  );
};

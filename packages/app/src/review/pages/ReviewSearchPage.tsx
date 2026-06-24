import { PostKind } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { EmptyState, Spinner } from "@rezics/ui";
import { useState } from "react";
import { QueryErrorDisplay } from "@/core";
import { ReviewList } from "@/review/components/list/ReviewList";
import { mapPostSearchDocToPostDTO } from "@/review/models/postSearchDocToPostDTO";
import { KeywordInput, useSearchQuery } from "@/search";
import { useLocalizedPostSearch } from "@/shared/hooks/useLocalizedMeiliSearch";

/**
 * Review search page.
 *
 * Keyword-based full-text search for reviews via Meilisearch.
 * Supports pagination and updates search results in real-time.
 *
 * 评论搜索页面。基于关键词的全文搜索。
 * 支持分页，实时更新搜索结果。
 *
 * Desktop (1200px):
 * +------------------------------------------+
 * | Review Search                            |
 * +------------------------------------------+
 * | [Search keyword...] [Go]                 |
 * +------------------------------------------+
 * | [Review 1] - Author | Book               |
 * | Rating: ★★★★★ | 2 weeks ago             |
 * |                                          |
 * | [Review 2] - Author | Book               |
 * | Rating: ★★★★ | 3 weeks ago               |
 * +------------------------------------------+
 * | [Prev] 1/5 [Next]                        |
 * +------------------------------------------+
 *
 * Tablet (768px):
 * +----------------------------+
 * | Review Search              |
 * +----------------------------+
 * | [Search...] [Go]           |
 * +----------------------------+
 * | [Review 1]                 |
 * | Author | Book              |
 * | ★★★★★                      |
 * |                            |
 * | [Review 2]                 |
 * | Author | Book              |
 * +----------------------------+
 *
 * Mobile (360px):
 * +----------+
 * | Search   |
 * +----------+
 * | [___]    |
 * | [Go]     |
 * +----------+
 * | Title    |
 * | Author   |
 * | ★★★★     |
 * +----------+
 *
 * Empty State:
 * +-----------+
 * | No results|
 * | Try again |
 * +-----------+
 */
export function ReviewSearchPage() {
  const { t } = useTranslation(["community"]);
  const search = useSearchQuery({});
  const [start, setStart] = useState(0);
  const limit = 20;
  const keyword = search.query.keyword ?? "";
  const keywordBind = search.bind("keyword");

  const { data, isLoading, isError, error } = useLocalizedPostSearch({
    kind: PostKind.REVIEW,
    keyword,
    offset: start,
    limit,
  });

  const reviews = data?.items?.map(mapPostSearchDocToPostDTO) ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold">
        {t("community:review_search_title")}
      </h1>

      <div className="mb-6">
        <KeywordInput
          value={keywordBind.value ?? ""}
          onChange={(v) => keywordBind.onChange(v)}
          onSubmit={() => setStart(0)}
          placeholder={t("community:review_search_placeholder")}
        />
      </div>

      {isError ? (
        <QueryErrorDisplay error={error} />
      ) : isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState title={t("community:review_search_empty_title")} />
      ) : (
        <ReviewList reviews={reviews} />
      )}
    </div>
  );
}

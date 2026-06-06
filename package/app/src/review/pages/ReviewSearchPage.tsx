import { PostKind } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { EmptyState, Spinner } from "@rezics/ui";
import { useState } from "react";
import { ReviewList } from "@/review/components/list/ReviewList";
import { mapPostSearchDocToPostDTO } from "@/review/models/postSearchDocToPostDTO";
import { KeywordInput } from "@/search/components/primitive";
import { useSearchQuery } from "@/search/hooks/useSearchQuery";
import { useLocalizedPostSearch } from "@/shared/hooks/useLocalizedMeiliSearch";

export function ReviewSearchPage() {
  const { t } = useTranslation(["community"]);
  const search = useSearchQuery({});
  const [start, setStart] = useState(0);
  const limit = 20;
  const keyword = search.query.keyword ?? "";
  const keywordBind = search.bind("keyword");

  const { data, isLoading } = useLocalizedPostSearch({
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

      {isLoading ? (
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

export default ReviewSearchPage;

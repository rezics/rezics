import { tagQueries } from "@rezics/api/tag/tag";
import type { UnitTagDTO } from "@rezics/contract";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { MUILink } from "@rezics/ui/primitive/link/MUILink.tsx";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMatchRoute } from "@tanstack/react-router";
import { tagBookRoute } from "@/router";
import { TagWrapper } from "../components/TagWrapper";

export function TagByBookPage() {
  const { bookId } = tagBookRoute.useParams();
  const pageSize = 30;
  const {
    data: listData,
    isLoading,
    error,
  } = useQuery(tagQueries.forUnit(bookId, { limit: pageSize }));

  const tagIds = listData?.tags?.map((t) => t.tagUnitId) ?? [];
  const detailsResults = useQueries({
    queries: tagIds.map((id) => tagQueries.detail(id)),
  });

  const _details: UnitTagDTO[] = detailsResults
    .map((r) => r.data)
    .filter(Boolean) as UnitTagDTO[];

  const total = listData?.tags?.length ?? 0;
  const showSeeAll = total > pageSize;

  return (
    <div className="w-11/12 mx-auto mt-16">
      <AccentBarWithText text={`标签`} />

      {isLoading && <div>加载中…</div>}
      {error && <div>加载失败</div>}

      {!isLoading && !error && (
        <div className="mt-4">
          <TagWrapper
            filters={{ unitId: bookId }}
            mode="grouped"
            renderAll={true}
          />
        </div>
      )}

      {showSeeAll && (
        <div className="mt-4">
          <MUILink to="/tag/book/$bookId/tag" params={{ bookId }}>
            <span className="text-primary-600 hover:underline">
              查看全部标签（{total}）
            </span>
          </MUILink>
        </div>
      )}
    </div>
  );
}

export function TagByBookFullPage() {
  const matchRoute = useMatchRoute();
  const withDomain = matchRoute({
    to: "/tag/book/$bookId/tag/$domainId",
    fuzzy: false,
  });
  const base = matchRoute({ to: "/tag/book/$bookId/tag", fuzzy: false });

  const bookId =
    (withDomain ? withDomain.bookId : "") || (base ? base.bookId : "") || "";

  const pageSize = 100;
  const {
    data: listData,
    isLoading,
    error,
  } = useQuery(tagQueries.forUnit(bookId, { limit: pageSize }));

  const tagIds = listData?.tags?.map((t) => t.tagUnitId) ?? [];
  const detailsResults = useQueries({
    queries: tagIds.map((id) => tagQueries.detail(id)),
  });

  const details: UnitTagDTO[] = detailsResults
    .map((r) => r.data)
    .filter(Boolean) as UnitTagDTO[];

  const total = listData?.tags?.length ?? 0;

  return (
    <div className="w-11/12 mx-auto mt-16">
      <AccentBarWithText text={`标签`} />

      {isLoading && <div>加载中…</div>}
      {error && <div>加载失败</div>}

      {!isLoading && !error && (
        <div className="mt-4">
          <TagWrapper
            filters={{ unitId: bookId }}
            mode="grouped"
            renderAll={true}
          />
        </div>
      )}

      <div className="mt-2 text-xs text-gray-500">
        total: {total} {details?.length ? `(details: ${details.length})` : ""}
      </div>
    </div>
  );
}

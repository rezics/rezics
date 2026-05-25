import { tagQueries } from "@rezics/api/tag/tag";
import type { UnitTagDTO } from "@rezics/contract";
import {
  common_load_failed,
  common_loading,
  tag_title,
  tag_view_all,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMatchRoute } from "@tanstack/react-router";
import { Route as tagBookRoute } from "@/routes/_mainLayout/tag/book/$bookId/route";
import { TextLink } from "@/shared/ui/link";
import { TagWrapper } from "../components/TagWrapper";

const i18nMessages = {
  common_load_failed,
  common_loading,
  tag_title,
  tag_view_all,
};

export function TagByBookPage() {
  const m = useMessage(i18nMessages);
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
      <AccentBarWithText text={m.tag_title()} />

      {isLoading && <div>{m.common_loading()}</div>}
      {error && <div>{m.common_load_failed()}</div>}

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
          <TextLink to="/tag/book/$bookId/tag" params={{ bookId }}>
            <span className="text-primary-600 hover:underline">
              {m.tag_view_all({ count: total })}
            </span>
          </TextLink>
        </div>
      )}
    </div>
  );
}

export function TagByBookFullPage() {
  const m = useMessage(i18nMessages);
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
      <AccentBarWithText text={m.tag_title()} />

      {isLoading && <div>{m.common_loading()}</div>}
      {error && <div>{m.common_load_failed()}</div>}

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

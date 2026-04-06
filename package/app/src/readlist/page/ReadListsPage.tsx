import { Alert } from "@mui/material";
import { buildMeiliReadlistQuery } from "@rezics/api/meili/meili.queries";
import { reactionApi } from "@rezics/api/reaction/reaction.api";
import type { ReadlistDTO } from "@rezics/contract";
import { UniversalPaginator, type UniversalPaginatorHandle } from "@rezics/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type SearchInfo, TextSearchInputWithIcon } from "@/search";

type Readlist = ReadlistDTO;

import { SingleReadlist } from "@/readlist/component/SingleReadlist.tsx";

// Simple list view for Readlists
const ReadlistListView: React.FC<{ readlists: Readlist[] }> = ({
  readlists,
}) => {
  return (
    <div>
      {readlists.map((item) => (
        <div key={item.id}>
          <SingleReadlist
            data={item}
            handleBookListClick={() => {}}
            handleLike={() => {}}
          />
        </div>
      ))}
    </div>
  );
};

function ErrorView({ error }: { error: Error }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-7xl p-4">
      <TextSearchInputWithIcon
        onSearch={() => {}}
        defaultValue={{ keyword: "" }}
        placeholder={t("page.readlist.list.search_placeholder")}
      />
      <Alert severity="error" className="my-4">
        {String(error)}
      </Alert>
    </div>
  );
}

type SortKey = "time" | "name" | "popular" | "agree";

/**
 * 后续API调整，Service调整的问题，是否要切换到 unit 查询，还是继续用独立服务。
 * @returns ReadListsPage
 */
export function ReadListsPage({ bookUnitId }: { bookUnitId?: string }) {
  const { t } = useTranslation();
  const universalPaginatorRef = useRef<UniversalPaginatorHandle>(null);
  const EXTERNAL_PAGE_SIZE = 100;
  const [currentQuery, setCurrentQuery] = useState<SearchInfo>({
    keyword: "",
    tags: [],
  });
  const [start, setStart] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading, error } = useQuery(
    buildMeiliReadlistQuery(
      start,
      EXTERNAL_PAGE_SIZE,
      currentQuery.keyword ?? "",
      currentQuery.tags ?? [],
      { bookId: bookUnitId ?? undefined },
    ),
  );

  function handleNeedMoreData(page: number) {
    setStart((page - 1) * EXTERNAL_PAGE_SIZE);
  }

  const queryClient = useQueryClient();
  async function handlePreRequestData(page: number) {
    const startOffset = (page - 1) * EXTERNAL_PAGE_SIZE;
    const { queryKey, queryFn } = buildMeiliReadlistQuery(
      startOffset,
      EXTERNAL_PAGE_SIZE,
      currentQuery.keyword ?? "",
      currentQuery.tags ?? [],
      { bookId: bookUnitId ?? undefined },
    );
    const data = await queryClient.fetchQuery({ queryKey, queryFn });
    console.log("handlePreRequestData", data, page);
    return data?.readlists?.length ?? 0;
  }

  useEffect(() => {
    console.log("data", data);
  }, [data]);

  useEffect(() => {
    universalPaginatorRef.current?.resetPaginationPageNumber();
    console.log("currentQuery", currentQuery);
  }, [currentQuery]);

  const baseReadlists: Readlist[] = useMemo(
    () => data?.readlists ?? [],
    [data],
  );

  const currentTargetIds = useMemo(
    () => baseReadlists.map((r) => r.id).filter(Boolean),
    [baseReadlists],
  );

  const { data: reactionSummaryBatch } = useQuery({
    queryKey: ["reaction-summary-batch", "readlists", currentTargetIds],
    queryFn: () => reactionApi.summaryBatch(currentTargetIds as string[]),
    enabled: currentTargetIds.length > 0,
    staleTime: 1000 * 60 * 2,
  });

  const [readlists, setReadlists] = useState<Readlist[]>([]);

  useEffect(() => {
    if (!baseReadlists || baseReadlists.length === 0) {
      setReadlists([]);
      return;
    }

    if (!reactionSummaryBatch) {
      setReadlists(baseReadlists);
      return;
    }

    const merged = baseReadlists.map((item) => {
      const summaryMap = reactionSummaryBatch.summaries[item.id];
      if (!summaryMap) return item;

      const reactionSummaries = Object.entries(summaryMap).map(
        ([reaction, count]) => ({
          reaction,
          count,
        }),
      );

      return {
        ...item,
        reactionSummaries,
      };
    });

    setReadlists(merged);
  }, [baseReadlists, reactionSummaryBatch]);

  const totalItems: number = data?.total ?? 0;

  const [sortConfig, setSortConfig] = useState<{
    type: SortKey;
    order: "asc" | "desc";
  }>({
    type: "time",
    order: "desc",
  });

  const handleSortChange = (newSort: {
    type?: string;
    order?: "asc" | "desc";
  }) => {
    console.log("handleSortChange, newSort", newSort);
    setSortConfig((prev) => ({
      type: (newSort.type as SortKey) ?? prev.type,
      order: newSort.order ?? prev.order,
    }));
  };

  if (error) {
    return <ErrorView error={error} />;
  }

  return (
    <div className="mx-auto max-w-7xl p-4">
      <UniversalPaginator<Readlist>
        ref={universalPaginatorRef}
        data={readlists}
        totalExternalItems={totalItems}
        itemsPerPage={10}
        externalItemsPerPage={EXTERNAL_PAGE_SIZE}
        sortType={sortConfig.type}
        sortOrder={sortConfig.order}
        onSortChange={handleSortChange}
        requestData={handleNeedMoreData}
        preRequestData={handlePreRequestData}
        isLoading={isLoading && readlists.length === 0}
        sortControl={
          <TextSearchInputWithIcon
            onSearch={(info) => {
              setCurrentQuery({
                keyword: info ?? "",
                tags: [],
              });
              console.log("onSearch", info);
            }}
            defaultValue={{ keyword: currentQuery.keyword ?? "" }}
            placeholder={t("page.readlist.list.search_placeholder")}
          />
        }
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
      >
        {(currentPageItems: Readlist[]) => (
          <ReadlistListView readlists={currentPageItems} />
        )}
      </UniversalPaginator>
    </div>
  );
}

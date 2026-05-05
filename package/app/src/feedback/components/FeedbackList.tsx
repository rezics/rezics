import { useAlertStore } from "@app/states/windowAlertStore";
import {
  Badge,
  Button,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { useSetFeedbackResolvedMutation } from "@rezics/api/feedback/feedback.mutations";
import type {
  FeedbackDTO,
  FeedbackType,
} from "@rezics/api/feedback/feedback.types";
import { buildMeiliFeedbackQuery } from "@rezics/api/meili/meili.queries";
import {
  UniversalPaginator,
  type UniversalPaginatorHandle,
} from "@rezics/ui/composite/pagination/Pagination.tsx";
import { SafeLink } from "@rezics/ui/link/SafeLink.tsx";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@rezics/ui/shadcn/popover.tsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import {
  CircleCheck as CheckCircleOutlineIcon,
  Check as DoneIcon,
  Hourglass as HourglassEmptyIcon,
} from "lucide-react";

export type FeedbackResolvedFilter = boolean | undefined;

export type FeedbackListProps = {
  queryType: "mine" | "all" | "user";
  userId?: string;
  /** Full-text search keyword. */
  search?: string;
  /** Filter by feedback type. */
  typeFilter?: FeedbackType;
  /** Filter by resolved status; `undefined` means all. */
  resolved?: FeedbackResolvedFilter;
};

const typeBadgeClass: Record<FeedbackDTO["type"], string> = {
  BUG: "bg-error-fill text-white",
  FEATURE: "bg-brand-fill text-white",
  REPORT: "bg-surface-subtle text-white",
  OTHER: "",
};

const EXTERNAL_PAGE_SIZE = 50;

const FeedbackList: React.FC<FeedbackListProps> = ({
  queryType,
  userId,
  search,
  typeFilter,
  resolved,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [startAll, setStartAll] = useState<number>(0);
  const [startMine, setStartMine] = useState<number>(0);
  const [startUser, setStartUser] = useState<number>(0);
  const { show: showAlert } = useAlertStore();
  const queryClient = useQueryClient();
  const paginatorRef = useRef<UniversalPaginatorHandle | null>(null);

  const listResult = useQuery(
    buildMeiliFeedbackQuery(startAll, EXTERNAL_PAGE_SIZE, search ?? "", {
      type: typeFilter,
      resolved,
    }),
  );

  const myResult = useQuery(
    buildMeiliFeedbackQuery(startMine, EXTERNAL_PAGE_SIZE, search ?? "", {
      type: typeFilter,
      resolved,
    }),
  );

  const byUserResult = useQuery(
    buildMeiliFeedbackQuery(startUser, EXTERNAL_PAGE_SIZE, search ?? "", {
      userId: userId ?? undefined,
      type: typeFilter,
      resolved,
    }),
  );

  const resolveMutation = useSetFeedbackResolvedMutation();

  const handleResolve = (id: string) => {
    resolveMutation.mutate({ id, resolved: true });
    showAlert("反馈已解决");
  };

  const activeResult =
    queryType === "mine"
      ? myResult
      : queryType === "user"
        ? byUserResult
        : listResult;

  const currentData = activeResult.data;
  const isLoading = activeResult.isLoading;
  const isError = activeResult.isError;

  useEffect(() => {
    setCurrentPage(1);
    if (queryType === "all") {
      setStartAll(0);
    } else if (queryType === "mine") {
      setStartMine(0);
    } else if (queryType === "user") {
      setStartUser(0);
    }

    paginatorRef.current?.resetPaginationPageNumber?.();
  }, [queryType]);

  const handleNeedMoreData = (externalPage: number) => {
    const offset = (externalPage - 1) * EXTERNAL_PAGE_SIZE;
    if (queryType === "mine") {
      setStartMine(offset);
    } else if (queryType === "user") {
      setStartUser(offset);
    } else {
      setStartAll(offset);
    }
  };

  const handlePreRequestData = async (externalPage: number) => {
    const offset = (externalPage - 1) * EXTERNAL_PAGE_SIZE;
    const limit = EXTERNAL_PAGE_SIZE;

    if (queryType === "mine") {
      const { queryKey, queryFn } = buildMeiliFeedbackQuery(
        offset,
        limit,
        search ?? "",
        {
          type: typeFilter,
          resolved,
        },
      );
      const next = await queryClient.fetchQuery({ queryKey, queryFn });
      return next?.items?.length ?? 0;
    }

    if (queryType === "user") {
      if (!userId) return 0;
      const { queryKey, queryFn } = buildMeiliFeedbackQuery(
        offset,
        limit,
        search ?? "",
        {
          userId,
          type: typeFilter,
          resolved,
        },
      );
      const next = await queryClient.fetchQuery({ queryKey, queryFn });
      return next?.items?.length ?? 0;
    }

    const { queryKey, queryFn } = buildMeiliFeedbackQuery(
      offset,
      limit,
      search ?? "",
      {
        type: typeFilter,
        resolved,
      },
    );
    const next = await queryClient.fetchQuery({ queryKey, queryFn });
    return next?.items?.length ?? 0;
  };

  return (
    <div>
      {isError && (
        <p className="text-sm text-error-text px-2 py-1">
          加载反馈失败，请稍后重试。
        </p>
      )}

      <UniversalPaginator<FeedbackDTO>
        ref={paginatorRef}
        data={currentData?.items ?? []}
        totalExternalItems={currentData?.totalItems ?? 0}
        itemsPerPage={10}
        externalItemsPerPage={EXTERNAL_PAGE_SIZE}
        sortType={undefined as any}
        sortOrder={undefined as any}
        onSortChange={() => {}}
        requestData={handleNeedMoreData}
        preRequestData={handlePreRequestData}
        isLoading={isLoading && (currentData?.items?.length ?? 0) === 0}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        disableSortControl={true}
      >
        {(currentPageItems: FeedbackDTO[]) => (
          <ul className="flex flex-col gap-3">
            {currentPageItems.map((item: FeedbackDTO) => (
              <li key={item.id}>
                <div className="w-full px-3 py-2 rounded-md border border-border-whisper bg-surface-elevated">
                  <div className="flex flex-row items-center justify-between gap-2 mb-1">
                    <div className="flex flex-row items-center gap-2 flex-wrap">
                      <Badge className={typeBadgeClass[item.type]}>
                        {item.type}
                      </Badge>
                      <p className="text-sm font-medium">反馈 #{item.id}</p>
                      {item.unitId && (
                        <Badge variant="outline">单元 {item.unitId}</Badge>
                      )}
                      {item.resolved ? (
                        <Badge className="bg-success-fill text-white inline-flex items-center gap-1">
                          <DoneIcon className="h-3 w-3" />
                          已解决
                        </Badge>
                      ) : (
                        <Badge className="bg-warning-fill text-white inline-flex items-center gap-1">
                          <HourglassEmptyIcon className="h-3 w-3" />
                          待处理
                        </Badge>
                      )}
                    </div>

                    {!item.resolved && (
                      <Popover>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <PopoverTrigger
                                  render={
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      disabled={resolveMutation.isPending}
                                      aria-label="标记为已解决"
                                    >
                                      <CheckCircleOutlineIcon className="h-4 w-4" />
                                    </Button>
                                  }
                                />
                              }
                            />
                            <TooltipContent>标记为已解决</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <PopoverContent>
                          <div className="flex flex-col gap-4 p-4">
                            <div className="text-base font-medium">
                              确定将此项目标记为已解决？
                            </div>

                            <Button onClick={() => handleResolve(item.id)}>
                              确定
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>

                  <div className="flex flex-row gap-4 text-xs text-text-secondary mb-1 flex-wrap">
                    <span>用户ID：{item.userId}</span>
                    <span>
                      创建时间：{new Date(item.createdAt).toLocaleString()}
                    </span>
                    <span>
                      更新时间：{new Date(item.updatedAt).toLocaleString()}
                    </span>
                    {item.resolvedAt && (
                      <span>
                        解决时间：{new Date(item.resolvedAt).toLocaleString()}
                      </span>
                    )}
                  </div>

                  <Separator className="my-1" />

                  <div>
                    {(() => {
                      const url = item.url ?? "";
                      if (!url) return null;
                      const isInternal = url.startsWith("/");
                      return isInternal ? (
                        <Link to={url}>{url}</Link>
                      ) : (
                        <SafeLink href={url}>{url}</SafeLink>
                      );
                    })()}
                  </div>
                  <p className="text-sm">{item.content}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </UniversalPaginator>
    </div>
  );
};

export default FeedbackList;

import { Alert, CircularProgress, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BookSearch } from "@/component/BookLib/BookSearch.tsx";
// import { CardBookList } from "@component/Book/CardBookList";
import { apiPost } from "@/api/swr.ts";
import { BookLibSortKey, BookSearchFilter } from "@/component/BookLib/BookSearchFilter.tsx";
import { UniversalPaginator } from "@/component/Common/Pagination.tsx";
import { SearchInfo } from "@/util/searchParser.ts";
import { BookListView } from "@component/BookLib/BookListView.tsx";
import { Book } from "contract";
import useSWR from "swr";

function buildQuery(info: SearchInfo): string {
    let q = info.searchText.trim();
    if (info.searchTags.length) {
        q = `${q} ${info.searchTags.map((t: string) => `[${t}]`).join(" ")}`
            .trim();
    }
    return q;
}

type Book = any;
export namespace BookLib {
    type ShowProps = {
        books: Book[];
        totalItems: number;
        isLoading: boolean;
        error: any;
        getBookList: (info: SearchInfo) => void;
        sortConfig: {
            type: BookLibSortKey;
            order: "asc" | "desc";
        };
        handleNeedMoreData: any;
        handleSortChange: any;
        EXTERNAL_PAGE_SIZE: number;
    };
    export const Show: React.FC<ShowProps> = ({
        books,
        totalItems,
        isLoading,
        error,
        getBookList,
        sortConfig,
        handleNeedMoreData,
        handleSortChange,
        EXTERNAL_PAGE_SIZE,
    }) => {
        const [currentPage, setCurrentPage] = useState(1);

        return (
            <div className="mx-auto max-w-7xl p-4">
                <BookSearch.Container onSearch={getBookList} />
                <div className="mt-4" />
                {
                    /* {isLoading && (
                    <div className="flex justify-center py-8">
                        <CircularProgress />
                    </div>
                )} */
                }
                {error && (
                    <Alert severity="error" className="my-4">
                        {String(error)}
                    </Alert>
                )}
                {books.length === 0 && !isLoading && (
                    <Typography variant="body1" className="mt-4 text-center">
                        No books found.
                    </Typography>
                )}
                <UniversalPaginator<Book>
                    data={books}
                    totalExternalItems={totalItems}
                    itemsPerPage={10}
                    externalItemsPerPage={EXTERNAL_PAGE_SIZE}
                    sortType={sortConfig.type}
                    sortOrder={sortConfig.order}
                    onSortChange={handleSortChange}
                    requestData={handleNeedMoreData}
                    isLoading={isLoading && books.length === 0}
                    sortControl={
                        <BookSearchFilter
                            sortType={sortConfig.type}
                            sortOrder={sortConfig.order}
                            onSortChange={handleSortChange}
                        />
                    }
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                >
                    {(currentPageItems: Book[]) => <BookListView.Container books={currentPageItems} />}
                </UniversalPaginator>
                {/* <CardBookList books={books} /> */}
            </div>
        );
    };
    export const Container: React.FC = () => {
        const EXTERNAL_PAGE_SIZE = 100;
        const [searchPage, setSearchPage] = useState(1);
        const [currentQuery, setCurrentQuery] = useState<SearchInfo>({
            searchText: "",
            searchTags: [],
        });

        const createBookListInput = {
            operation: "book.list",
            parameter: {
                query: {
                    tag: buildQuery(currentQuery),
                    sort: "recommend",
                    page: searchPage,
                    limit: EXTERNAL_PAGE_SIZE,
                },
            },
        };
        const { data, isLoading, error } = useSWR(createBookListInput, apiPost);

        function handleNeedMoreData(page: number) {
            setSearchPage(page);
        }

        useEffect(() => {
            console.log("data", data);
        }, [data]);

        const books: Book[] = useMemo(() => data?.items ?? [], [data]);
        const totalItems: number = data?.totalItems ?? 0;
        const getBookList = useCallback((info: SearchInfo) => {
            setCurrentQuery(info);
        }, []);

        const handleSortChange = (
            newSort: { type?: string; order?: "asc" | "desc" },
        ) => {
            console.log("handleSortChange, newSort", newSort);
            setSortConfig((prev) => ({
                type: newSort.type as BookLibSortKey,
                order: newSort.order ?? prev.order,
            }));
        };

        const [sortConfig, setSortConfig] = useState<{
            type: BookLibSortKey;
            order: "asc" | "desc";
        }>({
            type: "time",
            order: "desc",
        });
        return (
            <Show
                books={books}
                totalItems={totalItems}
                isLoading={isLoading}
                error={error}
                getBookList={getBookList}
                sortConfig={sortConfig}
                handleNeedMoreData={handleNeedMoreData}
                handleSortChange={handleSortChange}
                EXTERNAL_PAGE_SIZE={EXTERNAL_PAGE_SIZE}
            />
        );
    };
}

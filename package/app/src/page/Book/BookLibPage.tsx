import { useState, useCallback, useEffect, useMemo } from "react";
import { Typography, CircularProgress, Alert } from "@mui/material";

import { BookSearch } from "@/component/BookLib/BookSearch";
// import { CardBookList } from "@component/Book/CardBookList";
import { BookListView } from "@component/BookLib/BookListView";
import { BookSearchFilter, BookLibSortKey } from "@/component/BookLib/BookSearchFilter";
import { SearchInfo } from "@util/searchParser";
import { Book } from "contract";
import tsr from "@/api/tsr";
import { UniversalPaginator } from "@/component/Common/Pagination";

function buildQuery(info: SearchInfo): string {
    let q = info.searchText.trim();
    if (info.searchTags.length) {
        q = `${q} ${info.searchTags.map((t: string) => `[${t}]`).join(" ")}`.trim();
    }
    return q;
}

export const BookLib = () => {
    const EXTERNAL_PAGE_SIZE = 100;
    const [currentQuery, setCurrentQuery] = useState<SearchInfo>({
        searchText: "",
        searchTags: [],
    });
    const [page, setPage] = useState(1);

    const { data, isLoading, error } = tsr.book.list.useQuery({
        queryKey: ["books", currentQuery, page],
        queryData: {
            query: {
                tag: buildQuery(currentQuery),
                sort: "recommend",
                page,
                limit: EXTERNAL_PAGE_SIZE,
            },
        },
    });

    function handleNeedMoreData(page: number) {
        setPage(page);
    }

    const books: Book[] = useMemo(() => data?.body?.items ?? [], [data]);
    const getBookList = useCallback((info: SearchInfo) => {
        setCurrentQuery(info);
    }, []);

    const handleSortChange = (newSort: { type?: string; order?: "asc" | "desc" }) => {
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

    if (isLoading) {
        return (
            <div className="flex justify-center py-8">
                <CircularProgress />
            </div>
        );
    }
    if (error) {
        return (
            <Alert severity="error" className="my-4">
                {String(error)}
            </Alert>
        );
    }
    if (books.length === 0) {
        return (
            <Typography variant="body1" className="mt-4 text-center">
                No books found.
            </Typography>
        );
    }

    return (
        <div className="mx-auto max-w-7xl p-4">
            <BookSearch.Container onSearch={getBookList} />
            <div className="mt-4"/>
            <UniversalPaginator<Book>
                data={books}
                totalExternalItems={data?.body?.totalItems ?? 0}
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
            >
                {(currentPageItems: Book[]) => <BookListView.Container books={currentPageItems} />}
            </UniversalPaginator>
            {/* <CardBookList books={books} /> */}
        </div>
    );
};

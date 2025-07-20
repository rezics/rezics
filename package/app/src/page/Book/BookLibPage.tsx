import { useState, useCallback } from "react";
import { Typography, CircularProgress, Alert } from "@mui/material";


import { BookSearch } from "@/component/BookLib/BookSearch";
// import { CardBookList } from "@component/Book/CardBookList";
import { BookListView } from "@component/BookLib/BookListView";
import { BookSearchFilter } from "@/component/BookLib/BookSearchFilter";
import { SearchInfo } from "@util/searchParser";
import { Book } from "contract";
import tsr from "@/api/tsr";

function buildQuery(info: SearchInfo): string {
    let q = info.searchText.trim();
    if (info.searchTags.length) {
        q = `${q} ${info.searchTags.map((t: string) => `[${t}]`).join(" ")}`.trim();
    }
    return q;
}

export const BookLib = () => {
    const [currentQuery, setCurrentQuery] = useState<SearchInfo>({
        searchText: "",
        searchTags: [],
    });

    const { data, isLoading, error } = tsr.books.search.useQuery({
        queryKey: ["books", currentQuery],
        queryData: {
            query: {
                query: buildQuery(currentQuery),
                page: 1,
                limit: 10,
            },
        },
    });

    const books: Book[] = data?.body.items ?? [];
    const getBookList = useCallback((info: SearchInfo) => {
        setCurrentQuery(info);
    }, []);

    return (
        <div className="mx-auto max-w-7xl p-4">
            <BookSearch.Container onSearch={getBookList} />

            {isLoading && (
                <div className="flex justify-center py-8">
                    <CircularProgress />
                </div>
            )}

            {error && (
                <Alert severity="error" className="my-4">
                    {String(error)}
                </Alert>
            )}

            {!isLoading && books.length === 0 && (
                <Typography variant="body1" className="mt-4 text-center">
                    No books found.
                </Typography>
            )}

            {books.length > 0 && (
                <div className="mt-4 flex justify-end">
                    <BookSearchFilter />
                </div>
            )}

            <BookListView.Container books={books} />
            {/* <CardBookList books={books} /> */}
        </div>
    );
};

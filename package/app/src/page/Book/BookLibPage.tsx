import { useState, useCallback } from "react";
import { Typography, CircularProgress, Alert } from "@mui/material";
import { useQuery } from "urql";

import { BookSearch } from "@/component/BookLib/BookSearch";
import { CardBookList } from "@component/Book/CardBookList";
import { ListBookList } from "@component/Book/ListBookList";
import { BookSearchFilter } from "@/component/BookLib/BookSearchFilter";
import { SEARCH_BOOKS } from "@/graphql/bookSearch";
import { SearchInfo } from "@util/searchParser";

export interface Book {
    id: string;
    title: string;
    author: string;
    description: string;
    cover: string;
}

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

    const [result] = useQuery({
        query: SEARCH_BOOKS,
        variables: { query: buildQuery(currentQuery) },
        pause: !currentQuery.searchText && currentQuery.searchTags.length === 0,
    });

    const books: Book[] = result.data?.searchBooks ?? [];

    const getBookList = useCallback((info: SearchInfo) => {
        setCurrentQuery(info);
    }, []);

    return (
        <div className="mx-auto max-w-7xl p-4">
            <BookSearch onSearch={getBookList} />

            {result.fetching && (
                <div className="flex justify-center py-8">
                    <CircularProgress />
                </div>
            )}

            {result.error && (
                <Alert severity="error" className="my-4">
                    {result.error.message}
                </Alert>
            )}

            {!result.fetching && books.length === 0 && (
                <Typography variant="body1" className="mt-4 text-center">
                    No books found.
                </Typography>
            )}

            {books.length > 0 && (
            <div className="mt-4 flex justify-end">
                <BookSearchFilter />
            </div>
            )}

            <ListBookList books={books} />
            {/* <CardBookList books={books} /> */}
            
        </div>
    );
};

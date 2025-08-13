import { apiPost } from "@/api/swr.ts";
import { QuoteExcerptList } from "../Review/QuoteExcerptList.tsx";
import useSWR from "swr";

interface QuoteExcerpt {
    id: string;
    content: string;
    author: string;
    createdAt: string;
    updatedAt: string;
}

export namespace QuoteExcerptPreview {
    export type Show = {
        id?: string;
        data: QuoteExcerpt[];
        isLoading: boolean;
        error?: string;
    };

    export const Show: React.FC<Show> = ({ data, isLoading, error }) => {
        if (isLoading) return <div>Loading...</div>;
        if (error && error !== "null") return <div>Oh no... {error}</div>;

        return (
            <div>
                <QuoteExcerptList.Container data={data || []} />
            </div>
        );
    };

    export type Container = {
        id: string;
    };

    export const Container: React.FC<Container> = ({ id }) => {

        const createBookInput = {
            operation: "review.listQuotes",
            parameter: { bookId: id },
            select: {
                id: true,
                content: true,
                author: true,
                createdAt: true,
                updatedAt: true,
            },
        }

        const { data, isLoading, error } = useSWR(createBookInput, apiPost);

        if (!data?.success) return <div>No data</div>;
        return (
            <Show
                data={data?.success || []}
                isLoading={isLoading}
                error={String(error)}
            />
        );
    };
}

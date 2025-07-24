import { tsr } from "@/api/tsr";
import { QuoteExcerptList } from "../Review/QuoteExcerptList";
import { QuoteExcerpt } from "contract/schema";

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
        const { data, isLoading, error } = tsr.review.listQuotes.useQuery({
            queryKey: ["quoteExcerpt", id],
            queryData: {
                params: {
                    bookId: id,
                },
                query: {
                    page: 1,
                    limit: 2,
                    type: "popular",
                    order: "desc",
                },
            },
        });

        return (
            <Show
                data={data?.body || []}
                isLoading={isLoading}
                error={String(error)}
            />
        );
    };
}

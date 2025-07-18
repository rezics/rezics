import { useQuery } from "urql";
import { QuoteExcerptQuery } from "@/api/bookQuoteExcerpt";
import { QuoteExcerptList } from "../Review/QuoteExcerptList";
import { QuoteExcerpt } from "@/api/bookQuoteExcerpt";

export namespace QuoteExcerptPreview {
    export type Show = {
        id?: string;
        data: QuoteExcerpt[];
        isLoading: boolean;
        error?: string;
    };

    export const Show: React.FC<Show> = ({ data, isLoading, error }) => {
        if (isLoading) return <div>Loading...</div>;
        if (error) return <div>Oh no... {error}</div>;

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
        const [{ data, fetching, error }] = useQuery({
            query: QuoteExcerptQuery,
            variables: { bookId: id },
        });

        return <Show data={data?.quotes || []} isLoading={fetching} error={error?.message} />;
    };
}

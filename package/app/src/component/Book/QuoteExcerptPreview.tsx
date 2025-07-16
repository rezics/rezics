import { useQuery } from "urql";
import { QuoteExcerptQuery } from "@/api/bookQuoteExcerpt";
import { AccentBarWithText } from "@component/Common/AccentBar";
import { ArrowForwardIcon } from "@component/Common/ArrowForwardIcon";
import { Link } from "wouter";
import { QuoteExcerptList } from "../Review/QuoteExcerptList";
import { QuoteExcerpt } from "@/api/bookQuoteExcerpt";

export namespace QuoteExcerptPreview {
    export type Show = {
        id: string;
        data: QuoteExcerpt[];
        isLoading: boolean;
        error?: string;
    };

    export const Show: React.FC<Show> = ({ id, data, isLoading, error }) => {
        if (isLoading) return <div>Loading...</div>;
        if (error) return <div>Oh no... {error}</div>;

        return (
            <div>
                <Link href={`/book/${id}/quotes`} className="flex mb-4">
                    <ArrowForwardIcon.Container size={16}>
                        <AccentBarWithText.Container text="原文摘录" />
                    </ArrowForwardIcon.Container>
                </Link>
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

        return <Show id={id} data={data?.quotes || []} isLoading={fetching} error={error?.message} />;
    };
}

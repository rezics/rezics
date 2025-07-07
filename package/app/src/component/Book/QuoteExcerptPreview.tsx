import { useQuery } from "urql";
import { QuoteExcerptQuery } from "@/api/bookQuoteExcerpt";
import { AccentBarWithText } from "@component/Common/AccentBar";
import { ArrowForwardIcon } from "@component/Common/ArrowForwardIcon";
import { Link } from "@mui/material";
import { QuoteExcerptList } from "../Review/QuoteExcerptList";
interface QuoteExcerptPreviewProps {
    id: string;
}

export function QuoteExcerptPreview({ id }: QuoteExcerptPreviewProps) {
    // ANCHOR QuoteExcerptQuery
    const [{ data, fetching, error }] = useQuery({
        query: QuoteExcerptQuery,
        variables: { bookId: id },
    });
    if (fetching) return <div>Loading...</div>;
    if (error) return <div>Oh no... {error.message}</div>;
    return (
        <div>
            <Link href={`/book/${id}/quotes`} className="flex mb-4">
                <ArrowForwardIcon size={16}>
                    <AccentBarWithText text="原文摘录" />
                </ArrowForwardIcon>
            </Link>
            <QuoteExcerptList data={data?.quotes || []} />
        </div>
    );
}

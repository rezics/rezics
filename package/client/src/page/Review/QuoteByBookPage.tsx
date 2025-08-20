import { QuoteExcerptPreview } from "@/component/Book/QuoteExcerptPreview";
import { AccentBarWithText } from "@/component/Common/AccentBar";
import { ArrowForwardIcon } from "@/component/Common/ArrowForwardIcon";
import { QuoteEdit } from "@/component/Review/QuoteEdit";
import { useParams } from "wouter";

export function QuoteByBookPage() {
    const { bookId } = useParams();
    return (
        <div className="mt-10 mx-auto w-11/12">
            <ArrowForwardIcon.Container size={16}>
                <AccentBarWithText.Container text="原文摘录" />
            </ArrowForwardIcon.Container>
            <QuoteEdit />
            <QuoteExcerptPreview.Container id={bookId || ""} />
        </div>
    );
}

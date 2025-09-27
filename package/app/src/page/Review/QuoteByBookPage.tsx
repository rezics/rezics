import { QuoteExcerptPreviewContainer } from "@/component/Book/QuoteExcerptPreview.tsx";
import { AccentBarWithTextContainer } from "@/component/Common/AccentBar.tsx";
import { ArrowForwardIconContainer } from "@/component/Common/ArrowForwardIcon.tsx";
import { QuoteEdit } from "@/component/Review/QuoteEdit.tsx";
import { useParams } from "wouter";

export function QuoteByBookPage() {
  const { bookId } = useParams();
  return (
    <div className="mt-10 mx-auto w-11/12">
      <ArrowForwardIconContainer size={16}>
        <AccentBarWithTextContainer text="原文摘录" />
      </ArrowForwardIconContainer>
      <QuoteEdit />
      <QuoteExcerptPreviewContainer id={bookId || ""} />
    </div>
  );
}

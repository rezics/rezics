"use client";

import { BookLayoutShell } from "./layout-shell";

const title = "The Annotated Multilingual Catalog of Variant Editions, Adaptations, and Disputed Attributions";
const subtitle = "Private draft · 999 chapters · metadata migration pending";

export default {
  ContentTab: (
    <div className="mx-auto w-full max-w-3xl p-4">
      <BookLayoutShell activePath="/book/book-001" bookId="book-001" subtitle={subtitle} title={title}>
        <div className="text-muted-foreground py-8 text-sm">Content tab body</div>
      </BookLayoutShell>
    </div>
  ),
  MobileDiscussionTab: (
    <div className="w-[320px] p-4">
      <BookLayoutShell activePath="/book/book-001/discussion" bookId="book-001" subtitle={subtitle} title={title}>
        <div className="text-muted-foreground py-8 text-sm">Discussion tab body</div>
      </BookLayoutShell>
    </div>
  ),
  WideReviewTab: (
    <div className="w-[1536px] p-4">
      <BookLayoutShell activePath="/book/book-001/review" bookId="book-001" subtitle={subtitle} title={title}>
        <div className="text-muted-foreground py-8 text-sm">Review tab body</div>
      </BookLayoutShell>
    </div>
  ),
};

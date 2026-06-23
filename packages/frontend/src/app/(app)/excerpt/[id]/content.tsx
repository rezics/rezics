"use client";

import { QuoteIcon } from "lucide-react";
import { use } from "react";

export function ExcerptDetailContent({
  paramsPromise,
}: {
  readonly paramsPromise: Promise<{ id: string }>;
}) {
  const { id } = use(paramsPromise);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 py-4">
      <blockquote className="border-primary space-y-2 border-l-4 py-2 pl-4">
        <QuoteIcon className="text-muted-foreground size-5" />
        <p className="text-foreground text-lg italic leading-relaxed">
          Excerpt content will load once API is connected.
        </p>
        <footer className="text-muted-foreground text-sm">
          — <cite>Source book</cite> by Author
        </footer>
      </blockquote>

      <div className="text-muted-foreground py-8 text-center text-sm">
        Excerpt {id} — connecting to API...
      </div>
    </div>
  );
}

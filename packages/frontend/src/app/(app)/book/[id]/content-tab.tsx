"use client";

import { use } from "react";

export function BookContentTab({
  paramsPromise,
}: {
  readonly paramsPromise: Promise<{ id: string }>;
}) {
  const { id } = use(paramsPromise);

  return (
    <div className="space-y-4 py-4">
      <div className="text-muted-foreground py-8 text-center text-sm">
        Table of contents for book {id} — connecting to API...
      </div>
    </div>
  );
}

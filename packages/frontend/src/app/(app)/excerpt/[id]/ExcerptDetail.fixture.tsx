import { mockExcerpt } from "@/__cosmos__/mock-data";
import { Suspense } from "react";
import { ExcerptDetailContent } from "./content";

function ExcerptFixture({ id }: { readonly id: string }) {
  return (
    <div className="p-4 sm:p-6">
      <Suspense fallback={<div>Loading...</div>}>
        <ExcerptDetailContent paramsPromise={Promise.resolve({ id })} />
      </Suspense>
    </div>
  );
}

export default {
  Default: <ExcerptFixture id={mockExcerpt().unitId} />,
  NumericId: <ExcerptFixture id="1234567890" />,
  LongId: <ExcerptFixture id="excerpt-with-long-source-reference-and-selection-range" />,
  NarrowLongId: (
    <div className="max-w-80">
      <ExcerptFixture id="unbrokenexcerptidunbrokenexcerptidunbrokenexcerptid" />
    </div>
  ),
};

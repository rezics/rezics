import { Suspense } from "react";
import { ZoneDetailContent } from "./content";

function ZoneFixture({ slug }: { readonly slug: string }) {
  return (
    <div className="p-4 sm:p-6">
      <Suspense fallback={<div>Loading...</div>}>
        <ZoneDetailContent paramsPromise={Promise.resolve({ slug })} />
      </Suspense>
    </div>
  );
}

export default {
  Default: <ZoneFixture slug="alice-notebook" />,
  ChineseSlug: <ZoneFixture slug="世界文学札记" />,
  LongSlug: <ZoneFixture slug="personal-zone-with-a-long-slug-for-layout-pressure-and-tab-overflow" />,
  NarrowLongSlug: (
    <div className="max-w-80">
      <ZoneFixture slug="unbrokenzoneidentifierunbrokenzoneidentifierunbrokenzoneidentifier" />
    </div>
  ),
};

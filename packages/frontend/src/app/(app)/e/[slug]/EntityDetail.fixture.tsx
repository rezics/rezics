import { mockEntity } from "@/__cosmos__/mock-data";
import { Suspense } from "react";
import { EntityDetailContent } from "./content";

function EntityFixture({ slug }: { readonly slug: string }) {
  return (
    <div className="p-4 sm:p-6">
      <Suspense fallback={<div>Loading...</div>}>
        <EntityDetailContent paramsPromise={Promise.resolve({ slug })} />
      </Suspense>
    </div>
  );
}

export default {
  Default: <EntityFixture slug={mockEntity().slug} />,
  OrganizationSlug: <EntityFixture slug="open-source-publishing-collective" />,
  ChineseSlug: <EntityFixture slug="鲁迅-lu-xun" />,
  LongSlug: <EntityFixture slug="this-is-a-very-long-entity-slug-that-might-cause-truncation-issues-in-the-ui" />,
  NarrowLongSlug: (
    <div className="max-w-80">
      <EntityFixture slug="singleunbrokenentityslugsingleunbrokenentityslugsingleunbrokenentityslug" />
    </div>
  ),
};

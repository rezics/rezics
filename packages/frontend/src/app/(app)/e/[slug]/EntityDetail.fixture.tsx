import { EntityDetailContent } from "./content";
import { Suspense } from "react";

export default {
  Default: (
    <Suspense fallback={<div>Loading...</div>}>
      <EntityDetailContent paramsPromise={Promise.resolve({ slug: "harold-abelson" })} />
    </Suspense>
  ),
  LongSlug: (
    <Suspense fallback={<div>Loading...</div>}>
      <EntityDetailContent
        paramsPromise={Promise.resolve({
          slug: "this-is-a-very-long-entity-slug-that-might-cause-truncation-issues-in-the-ui",
        })}
      />
    </Suspense>
  ),
  ChineseSlug: (
    <Suspense fallback={<div>Loading...</div>}>
      <EntityDetailContent
        paramsPromise={Promise.resolve({ slug: "鲁迅-lu-xun" })}
      />
    </Suspense>
  ),
};

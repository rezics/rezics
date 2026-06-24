import { ExcerptDetailContent } from "./content";
import { Suspense } from "react";

export default {
  Default: (
    <Suspense fallback={<div>Loading...</div>}>
      <ExcerptDetailContent paramsPromise={Promise.resolve({ id: "excerpt-001" })} />
    </Suspense>
  ),
};

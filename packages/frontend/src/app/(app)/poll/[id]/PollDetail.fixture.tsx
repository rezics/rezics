import { PollDetailContent } from "./content";
import { Suspense } from "react";

export default {
  Default: (
    <Suspense fallback={<div>Loading...</div>}>
      <PollDetailContent paramsPromise={Promise.resolve({ id: "poll-001" })} />
    </Suspense>
  ),
};

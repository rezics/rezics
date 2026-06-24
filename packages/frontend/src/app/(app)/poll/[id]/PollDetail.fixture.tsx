import { mockPoll } from "@/__cosmos__/mock-data";
import { Suspense } from "react";
import { PollDetailContent } from "./content";

function PollFixture({ id }: { readonly id: string }) {
  return (
    <div className="p-4 sm:p-6">
      <Suspense fallback={<div>Loading...</div>}>
        <PollDetailContent paramsPromise={Promise.resolve({ id })} />
      </Suspense>
    </div>
  );
}

export default {
  Default: <PollFixture id={mockPoll().unitId} />,
  ClosedPollId: <PollFixture id="poll-closed-permission-readonly" />,
  LongId: <PollFixture id="poll-with-long-realm-scoped-decision-and-migration-question" />,
  NarrowLongId: (
    <div className="max-w-80">
      <PollFixture id="unbrokenpollidunbrokenpollidunbrokenpollidunbrokenpollid" />
    </div>
  ),
};

import { pollDetailQuery } from "@rezics/api/poll/poll.queries";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { titleMeta, titleOfPoll } from "@/core/routing/documentTitle";
import { PollPage } from "@/poll";

export const Route = createFileRoute("/_mainLayout/poll/$unitId")({
  loader: async ({ params, context }) => {
    const poll = await context.qc
      .ensureQueryData(pollDetailQuery(params.unitId))
      .catch(() => {
        throw notFound();
      });
    return { poll };
  },
  head: ({ loaderData }) =>
    titleMeta(loaderData ? titleOfPoll(loaderData.poll) : null),
  component: () => {
    const { unitId } = Route.useParams();
    return <PollPage unitId={unitId} />;
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { PollPage } from "@/poll";

export const Route = createFileRoute("/_mainLayout/poll/$unitId")({
  component: () => {
    const { unitId } = Route.useParams();
    return <PollPage unitId={unitId} />;
  },
});

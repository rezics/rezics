import { createFileRoute } from "@tanstack/react-router";
import { PostThreadPage } from "@/post/pages/PostThreadPage";

export const Route = createFileRoute(
  "/_mainLayout/realm/$realmId/post/$postUnitId",
)({
  component: () => {
    const { realmId } = Route.useParams();
    return <PostThreadPage realmUnitId={realmId} />;
  },
});

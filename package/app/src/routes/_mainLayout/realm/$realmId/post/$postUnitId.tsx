import { createFileRoute, notFound } from "@tanstack/react-router";
import { PostThreadPage } from "@/post";
import { isRealmUnitIdParam } from "@/realm/models/realmDetailRoutes";

export const Route = createFileRoute(
  "/_mainLayout/realm/$realmId/post/$postUnitId",
)({
  loader: ({ params }) => {
    if (!isRealmUnitIdParam(params.realmId)) throw notFound();
  },
  component: () => {
    const { realmId } = Route.useParams();
    return <PostThreadPage realmUnitId={realmId} />;
  },
});

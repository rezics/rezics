import { createFileRoute } from "@tanstack/react-router";
import { ShelfEditPage } from "@/shelf/pages/ShelfEditPage";

export const Route = createFileRoute("/_mainLayout/shelf/$shelfId/edit")({
  component: () => {
    const { shelfId } = Route.useParams();
    return <ShelfEditPage shelfId={shelfId} />;
  },
});

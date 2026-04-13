import { createFileRoute } from "@tanstack/react-router";
import { ShelfPage } from "@/shelf/page/ShelfPage";

export const Route = createFileRoute("/_mainLayout/shelf/$shelfId/")({
  component: () => {
    const { shelfId } = Route.useParams();
    return <ShelfPage unitId={shelfId} />;
  },
});

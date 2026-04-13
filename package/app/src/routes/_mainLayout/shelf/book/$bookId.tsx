import { createFileRoute } from "@tanstack/react-router";
import { ShelfByBookPage } from "@/shelf/page/ShelfByBookPage";

export const Route = createFileRoute("/_mainLayout/shelf/book/$bookId")({
  component: () => {
    const { bookId } = Route.useParams();
    return <ShelfByBookPage bookId={bookId} />;
  },
});

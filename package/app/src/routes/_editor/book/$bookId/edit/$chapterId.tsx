import { chapterDetailQuery } from "@rezics/api/chapter/chapter";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { routeQueryOrNotFound } from "@/core";

const BookEditChapterPage = lazyRouteComponent(
  () => import("@/book-edit"),
  "BookEditChapterPage",
);

export const Route = createFileRoute("/_editor/book/$bookId/edit/$chapterId")({
  loader: async ({ params, context }) => {
    await routeQueryOrNotFound(
      context.qc,
      chapterDetailQuery(params.chapterId),
    );
  },
  component: BookEditChapterPage,
});

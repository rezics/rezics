import { createFileRoute } from "@tanstack/react-router";
import { PostThreadPage } from "@/post";

export const Route = createFileRoute("/_mainLayout/z/$slug/post/$postUnitId")({
  component: () => <PostThreadPage />,
});

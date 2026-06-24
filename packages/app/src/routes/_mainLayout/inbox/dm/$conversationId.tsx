import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const DmConversationPage = lazyRouteComponent(
  () => import("@/inbox/pages/DmConversationPage"),
  "DmConversationPage",
);

export const Route = createFileRoute("/_mainLayout/inbox/dm/$conversationId")({
  component: DmConversationPage,
});

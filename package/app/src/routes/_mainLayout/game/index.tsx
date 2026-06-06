import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const GameHomePage = lazyRouteComponent(
  () => import("@/game-library"),
  "GameHomePage",
);

export const Route = createFileRoute("/_mainLayout/game/")({
  component: GameHomePage,
});

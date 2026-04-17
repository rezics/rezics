import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const QuoteByBookPage = lazyRouteComponent(
  () => import("@/quote/pages/QuoteByBookPage"),
  "QuoteByBookPage",
);

export const Route = createFileRoute("/_mainLayout/quote/book/$bookId")({
  component: QuoteByBookPage,
});

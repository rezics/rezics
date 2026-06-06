import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const DmInboxPage = lazyRouteComponent(
  () => import("@/inbox/pages/DmInboxPage"),
  "DmInboxPage",
);

type DmInboxSearch = {
  /** Optional peer to open a conversation with (set by the DM action). */
  peerId?: string;
};

export const Route = createFileRoute("/_mainLayout/inbox/dm/")({
  validateSearch: (search: Record<string, unknown>): DmInboxSearch => ({
    peerId: typeof search.peerId === "string" ? search.peerId : undefined,
  }),
  component: DmInboxPage,
});

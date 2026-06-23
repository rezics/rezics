import { redirect } from "next/navigation";

/**
 * /inbox redirects to the notifications sub-route.
 * The layout renders the heading and tab nav; this page
 * only needs to pick a default tab on first visit.
 */
export default function InboxPage() {
  redirect("/inbox/notifications");
}

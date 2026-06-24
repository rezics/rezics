"use client";

import { BottomNav } from "./BottomNav";

/**
 * BottomNav fixture — anonymous state (no backend in Cosmos).
 * authClient.useSession() returns { data: null } → Inbox/Profile show as buttons
 * that trigger the auth dialog on click.
 */
export default {
  Anonymous: <BottomNav />,
};

"use client";

import { Header } from "./Header";

/**
 * Header fixture — anonymous state only (no backend in Cosmos).
 * authClient.useSession() returns { data: null } → shows Sign in / Sign up buttons.
 */
export default {
  Anonymous: <Header />,
};

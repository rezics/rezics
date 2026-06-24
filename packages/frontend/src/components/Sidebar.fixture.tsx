"use client";

import { Sidebar } from "./Sidebar";

/**
 * Sidebar fixture — default state (no backend in Cosmos).
 * myRealmsQuery won't resolve → JoinedRealms renders null → only static nav links shown.
 * Sidebar is max-lg:hidden in production; rendered without that constraint in Cosmos.
 */
export default {
  Default: <Sidebar />,
};

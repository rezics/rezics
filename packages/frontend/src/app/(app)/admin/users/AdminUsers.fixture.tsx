"use client";

import { AdminUsersContent, type AdminUserRow } from "./page";

const longUser: AdminUserRow = {
  id: "user-long",
  name: "Dr. Eleanor Zhang-Smythe von Hyperbibliographic-Reconciliation",
  email: "eleanor.zhang-smythe.extremely-long-address@subdomain.community-archive.example",
  role: "realm curator / trust reviewer",
  status: "invited, pending identity review",
  joined: "2025-06-20",
};

const manyUsers: AdminUserRow[] = Array.from({ length: 48 }, (_, index) => ({
  id: `user-${index}`,
  name: `Catalog maintainer ${String(index + 1).padStart(2, "0")}`,
  email: `maintainer.${index + 1}@rezics.example`,
  role: index % 5 === 0 ? "admin" : "member",
  status: index % 7 === 0 ? "suspended" : "active",
  joined: `2025-05-${String((index % 28) + 1).padStart(2, "0")}`,
}));

export default {
  Empty: (
    <div className="w-full max-w-5xl p-4">
      <AdminUsersContent />
    </div>
  ),
  LongTextRows: (
    <div className="w-[320px] p-4">
      <AdminUsersContent rows={[longUser]} initialQuery="identity review" />
    </div>
  ),
  ExplodingList: (
    <div className="w-full max-w-5xl p-4">
      <AdminUsersContent rows={manyUsers} initialQuery="maintainer" />
    </div>
  ),
  DisabledSearch: (
    <div className="w-full max-w-5xl p-4">
      <AdminUsersContent disabled rows={manyUsers.slice(0, 6)} initialQuery="locked role" />
    </div>
  ),
};

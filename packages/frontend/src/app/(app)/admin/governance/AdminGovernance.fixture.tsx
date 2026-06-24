"use client";

import { AdminGovernanceContent, type AdminGovernanceRow } from "./page";

const longCase: AdminGovernanceRow = {
  id: "case-long",
  type: "Cross-realm duplicate merge appeal with conflicting moderator decisions",
  reporter: "moderator-with-an-extremely-long-public-handle@example-realm",
  target: "unit:book-with-many-linked-editions-translations-and-deprecated-aliases",
  severity: "critical",
  status: "blocked pending council quorum",
};

const manyCases: AdminGovernanceRow[] = Array.from({ length: 45 }, (_, index) => ({
  id: `case-${index}`,
  type: index % 4 === 0 ? "merge appeal" : "content report",
  reporter: `reporter-${index + 1}`,
  target: `unit-${String(index + 1).padStart(3, "0")}`,
  severity: index % 6 === 0 ? "high" : "normal",
  status: index % 5 === 0 ? "escalated" : "open",
}));

export default {
  Empty: (
    <div className="w-full max-w-5xl p-4">
      <AdminGovernanceContent />
    </div>
  ),
  LongTextRows: (
    <div className="w-[320px] p-4">
      <AdminGovernanceContent rows={[longCase]} initialQuery="quorum" />
    </div>
  ),
  ExplodingList: (
    <div className="w-full max-w-5xl p-4">
      <AdminGovernanceContent rows={manyCases} initialQuery="open" />
    </div>
  ),
  DisabledSearch: (
    <div className="w-full max-w-5xl p-4">
      <AdminGovernanceContent disabled rows={manyCases.slice(0, 6)} initialQuery="moderator only" />
    </div>
  ),
};

"use client";

import { AdminRealmsContent, type AdminRealmRow } from "./page";

const longRealm: AdminRealmRow = {
  id: "realm-long",
  name: "Comparative Editions, Translations, Adaptations, and Borderline Canon Debates",
  slug: "comparative-editions-translations-adaptations-borderline-canon-debates",
  members: "1,234,567",
  posts: "98,765",
  created: "2025-01-11",
};

const manyRealms: AdminRealmRow[] = Array.from({ length: 52 }, (_, index) => ({
  id: `realm-${index}`,
  name: `Reading circle ${String(index + 1).padStart(2, "0")}`,
  slug: `reading-circle-${index + 1}`,
  members: (index * 137 + 24).toLocaleString("en-US"),
  posts: (index * 29).toLocaleString("en-US"),
  created: `2025-04-${String((index % 28) + 1).padStart(2, "0")}`,
}));

export default {
  Empty: (
    <div className="w-full max-w-5xl p-4">
      <AdminRealmsContent />
    </div>
  ),
  LongTextRows: (
    <div className="w-[320px] p-4">
      <AdminRealmsContent rows={[longRealm]} initialQuery="canon debates" />
    </div>
  ),
  ExplodingList: (
    <div className="w-full max-w-5xl p-4">
      <AdminRealmsContent rows={manyRealms} initialQuery="reading" />
    </div>
  ),
  DisabledSearch: (
    <div className="w-full max-w-5xl p-4">
      <AdminRealmsContent disabled rows={manyRealms.slice(0, 6)} initialQuery="moderated" />
    </div>
  ),
};

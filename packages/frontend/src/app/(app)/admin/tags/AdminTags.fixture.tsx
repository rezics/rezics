"use client";

import { AdminTagsContent, type AdminTagRow } from "./page";

const longTag: AdminTagRow = {
  id: "tag-long",
  name: "intertextuality-with-contested-community-specific-definition-and-aliases",
  category: "classification / migration candidate / needs merge review",
  usage: "1,000,000",
  created: "2025-06-01",
};

const manyTags: AdminTagRow[] = Array.from({ length: 60 }, (_, index) => ({
  id: `tag-${index}`,
  name: `topic-${String(index + 1).padStart(2, "0")}`,
  category: index % 3 === 0 ? "genre" : "theme",
  usage: (index * 41).toLocaleString("en-US"),
  created: `2025-01-${String((index % 28) + 1).padStart(2, "0")}`,
}));

export default {
  Empty: (
    <div className="w-full max-w-5xl p-4">
      <AdminTagsContent />
    </div>
  ),
  LongTextRows: (
    <div className="w-[320px] p-4">
      <AdminTagsContent rows={[longTag]} initialQuery="intertextuality" />
    </div>
  ),
  ExplodingList: (
    <div className="w-full max-w-5xl p-4">
      <AdminTagsContent rows={manyTags} initialQuery="topic" />
    </div>
  ),
  DisabledSearch: (
    <div className="w-full max-w-5xl p-4">
      <AdminTagsContent disabled rows={manyTags.slice(0, 6)} initialQuery="merge locked" />
    </div>
  ),
};

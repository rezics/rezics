"use client";

import type { ContentStructureNodeDTO } from "@rezics/backend/api";
import { BookContentTree } from "./content-tab";

const nestedNodes: ContentStructureNodeDTO[] = [
  {
    id: "part-1",
    parentId: null,
    position: "001",
    contentUnitId: null,
    title: "Part I: Foundations",
    noContent: true,
  },
  {
    id: "chapter-1",
    parentId: "part-1",
    position: "001",
    contentUnitId: "chapter-1-unit",
    title: "Programs Must Be Written for People to Read",
    noContent: false,
  },
  {
    id: "chapter-long",
    parentId: "part-1",
    position: "002",
    contentUnitId: "chapter-long-unit",
    title: "A Very Long Chapter Title About Translation Layers, Edition Boundaries, and Cataloging Policy That Must Truncate",
    noContent: false,
  },
  {
    id: "section-1",
    parentId: "chapter-long",
    position: "001",
    contentUnitId: null,
    title: "Appendices and disputed fragments",
    noContent: true,
  },
  {
    id: "fragment-1",
    parentId: "section-1",
    position: "001",
    contentUnitId: "fragment-1-unit",
    title: "Fragment with missing source",
    noContent: false,
  },
];

const manyNodes: ContentStructureNodeDTO[] = Array.from({ length: 64 }, (_, index) => ({
  id: `chapter-${index}`,
  parentId: null,
  position: String(index).padStart(3, "0"),
  contentUnitId: `chapter-${index}-unit`,
  title: `Chapter ${String(index + 1).padStart(2, "0")}`,
  noContent: false,
}));

export default {
  Empty: (
    <div className="p-4">
      <BookContentTree nodes={[]} />
    </div>
  ),
  NestedLongTitles: (
    <div className="w-[320px] p-4">
      <BookContentTree nodes={nestedNodes} />
    </div>
  ),
  ExplodingList: (
    <div className="p-4">
      <BookContentTree nodes={manyNodes} />
    </div>
  ),
};

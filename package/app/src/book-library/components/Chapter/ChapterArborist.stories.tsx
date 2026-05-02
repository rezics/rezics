import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef } from "react";

import { withRouter } from "@/stories/decorators/withRouter";
import {
  type Chapter,
  ChapterArborist,
  type ChapterArboristRefHandle,
} from "./ChapterArborist";

const shallowTree: Chapter[] = [
  { id: "1", title: "Preface" },
  { id: "2", title: "Chapter 1: Quiet rooms" },
  { id: "3", title: "Chapter 2: Borrowed light" },
  { id: "4", title: "Afterword" },
];

const deepTree: Chapter[] = Array.from({ length: 12 }, (_, i) => ({
  id: `c${i + 1}`,
  title: `Chapter ${i + 1}`,
  children: Array.from({ length: 3 }, (_, j) => ({
    id: `c${i + 1}-s${j + 1}`,
    title: `Section ${i + 1}.${j + 1}`,
  })),
}));

const Wrapper = (args: {
  chapterTree: Chapter[];
  searchTerm?: string;
  selectedId?: string;
}) => {
  const ref = useRef<ChapterArboristRefHandle | null>(null);
  return (
    <ChapterArborist
      ref={ref}
      chapterTree={args.chapterTree}
      tHeight={300}
      searchTerm={args.searchTerm ?? ""}
      selectedId={args.selectedId ?? ""}
      bookUnitId="book-quiet-library"
      baseLink="book-quiet-library"
      width={320}
    />
  );
};

const meta = {
  title: "Domain/Book/ChapterArborist",
  component: Wrapper,
  decorators: [withRouter],
  args: { chapterTree: shallowTree },
} satisfies Meta<typeof Wrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { chapterTree: [] },
};

export const Large: Story = {
  args: { chapterTree: deepTree },
};

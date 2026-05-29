import { bookApi } from "@rezics/api/book/book.api";
import { shelfUnitsQuery, userShelvesQuery } from "@rezics/api/shelf";
import { userQueries } from "@rezics/api/user/user.queries";
import type {
  BookDTO,
  BookshelfViewConfig,
  ContinueReadingItem,
  ShelfSummaryDTO,
} from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import { expect, waitFor, within } from "storybook/test";

import { withRouter } from "@/stories/decorators/withRouter";
import { DashboardLibrarySection } from "./DashboardLibrarySection";

const SHELF: ShelfSummaryDTO = {
  unitId: "shelf-1",
  title: "Reading",
  itemCount: 2,
};

const BOOKS: BookDTO[] = [
  {
    unitId: "b1",
    translations: [{ language: "en", title: "Dune" }],
    coverUrl:
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>",
    isLicensed: true,
  },
  {
    unitId: "b2",
    translations: [{ language: "en", title: "Solaris" }],
    coverUrl:
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>",
    isLicensed: false,
  },
] as unknown as BookDTO[];

const CONTINUE_READING: ContinueReadingItem[] = [
  {
    bookUnitId: "b1",
    bookTitle: "Dune",
    lastReadNodeId: "n3",
    lastReadNodeTitle: "Chapter 3",
    chaptersCompleted: 3,
    chaptersTotal: 12,
    resumeRoute: { kind: "node", bookId: "b1", nodeId: "n3" },
  },
];

const VIEWER_CONFIG: BookshelfViewConfig = {
  breakpoints: [{ minWidthPx: 0, columns: 4 }],
  showTitle: true,
};

function StoryHost({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const originalList = bookApi.list;
    // Hydration fans book ids out to bookApi.list; serve the fixtures.
    bookApi.list = (async () => ({ books: BOOKS })) as typeof bookApi.list;

    qc.setQueryData(userShelvesQuery().queryKey, [SHELF]);
    qc.setQueryData(userQueries.settings().queryKey, {
      library: { bookshelf: VIEWER_CONFIG },
    });
    qc.setQueryData(shelfUnitsQuery(SHELF.unitId, { limit: 24 }).queryKey, {
      units: [
        { shelfId: SHELF.unitId, unitId: "b1", kind: "book", position: "a" },
        { shelfId: SHELF.unitId, unitId: "b2", kind: "book", position: "b" },
      ],
      relations: [],
      hasMore: false,
    });
    setReady(true);
    return () => {
      bookApi.list = originalList;
      qc.clear();
    };
  }, [qc]);
  if (!ready) return null;
  return <div className="p-6">{children}</div>;
}

const meta = {
  title: "App/Dashboard/DashboardLibrarySection",
  component: DashboardLibrarySection,
  decorators: [withRouter],
} satisfies Meta<typeof DashboardLibrarySection>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default (readable filter on): the licensed book renders with its server
 * chapter counter; the unlicensed book is hidden.
 */
export const ReadableDefault: Story = {
  render: () => (
    <StoryHost>
      <DashboardLibrarySection continueReading={CONTINUE_READING} />
    </StoryHost>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Licensed book appears with its chapter-completion counter.
    await waitFor(() => expect(canvas.getByText("Dune")).toBeInTheDocument());
    expect(canvas.getByText("3/12")).toBeInTheDocument();
    // Unlicensed book is filtered out by the dashboard default.
    expect(canvas.queryByText("Solaris")).toBeNull();
  },
};

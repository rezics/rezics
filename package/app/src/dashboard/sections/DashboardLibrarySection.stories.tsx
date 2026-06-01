import { userQueries } from "@rezics/api/user/user.queries";
import type { BookshelfViewConfig, ProgressLibraryRow } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import { expect, waitFor, within } from "storybook/test";

import { withRouter } from "@/stories/decorators/withRouter";
import { DashboardLibrarySection } from "./DashboardLibrarySection";

const PROGRESS_ROWS: ProgressLibraryRow[] = [
  {
    progress: {
      userId: "user-1",
      unitId: "b1",
      progress: 0.25,
      status: "ACTIVE",
      isDeleted: false,
      completedCount: 3,
      totalTimeMs: 0,
      lastReadNodeId: "n3",
      lastReadAnchor: null,
      firstSeenAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-02T00:00:00.000Z",
      extra: null,
    },
    unit: {
      unitId: "b1",
      title: "Dune",
      coverUrl:
        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>",
      unitType: "BOOK",
    },
    resumeRoute: { kind: "node", bookId: "b1", nodeId: "n3" },
    shelves: [],
  },
  {
    progress: {
      userId: "user-1",
      unitId: "variant-1",
      progress: 0.1,
      status: "ACTIVE",
      isDeleted: false,
      completedCount: 0,
      totalTimeMs: 0,
      lastReadNodeId: null,
      lastReadAnchor: null,
      firstSeenAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-02T00:00:00.000Z",
      extra: null,
    },
    unit: {
      unitId: "variant-1",
      title: "Solaris: First Edition",
      coverUrl:
        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>",
      unitType: "BOOK",
    },
    resumeRoute: { kind: "book", bookId: "variant-1" },
    shelves: [],
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
    qc.setQueryData(userQueries.settings().queryKey, {
      library: { bookshelf: VIEWER_CONFIG },
    });
    setReady(true);
    return () => {
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
 * Dashboard library renders progress-owned rows; no shelf membership fixture is
 * required.
 */
export const ReadableDefault: Story = {
  render: () => (
    <StoryHost>
      <DashboardLibrarySection progressRows={PROGRESS_ROWS} />
    </StoryHost>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("Dune")).toBeInTheDocument());
    expect(canvas.getByText("Solaris: First Edition")).toBeInTheDocument();
  },
};

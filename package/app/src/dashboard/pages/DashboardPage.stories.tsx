import { dashboardSummaryQuery } from "@rezics/api/dashboard";
import type {
  ContinueReadingItem,
  DashboardRealmSummary,
  DashboardSectionResult,
  DashboardShelfSummary,
  DashboardSummary,
} from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import { expect, waitFor, within } from "storybook/test";

import { withRouter } from "@/stories/decorators/withRouter";
import { DashboardPage } from "./DashboardPage";

// ------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------

function ok<T>(value: T): DashboardSectionResult<T> {
  return { ok: value };
}

function failed(retryable: boolean): DashboardSectionResult<never> {
  return { error: { code: "SECTION_FAILED", retryable } };
}

const CLEAN_SAFETY = {
  enforcementActive: false,
  accountBlocked: false,
  pendingReportsAgainstUser: 0,
  notices: [],
};

const READING_ITEM: ContinueReadingItem = {
  bookUnitId: "book-1",
  bookTitle: "War and Peace",
  lastReadNodeId: "node-3",
  lastReadNodeTitle: "Chapter 3",
  chaptersCompleted: 3,
  chaptersTotal: 10,
  resumeRoute: { kind: "node", bookId: "book-1", nodeId: "node-3" },
};

const SHELF: DashboardShelfSummary = {
  shelfUnitId: "shelf-1",
  title: "To Read",
  itemCount: 12,
  coverUrls: [],
};

const REALM: DashboardRealmSummary = {
  realmId: "realm-1",
  name: "Russian Literature",
  slug: "russian-lit",
};

/** Build a full summary; every section defaults to an empty `ok` value. */
function makeSummary(
  overrides: Partial<DashboardSummary> = {},
): DashboardSummary {
  return {
    continueReading: ok([]),
    shelves: ok([]),
    realms: ok([]),
    notifications: ok({ unreadCount: 0, latestKindKeys: [] }),
    dms: ok({ unreadCount: 0, conversationCount: 0 }),
    drafts: ok([]),
    activity: ok([]),
    safety: ok(CLEAN_SAFETY),
    ...overrides,
  };
}

// ------------------------------------------------------------
// Host: seed the dashboard summary into the query cache, then render the
// real page so its loading/error/partial-success branches all exercise.
// ------------------------------------------------------------

function StoryHost({
  summary,
  children,
}: {
  summary: DashboardSummary;
  children: ReactNode;
}) {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const key = dashboardSummaryQuery().queryKey;
    qc.setQueryData(key, summary);
    setReady(true);
    return () => {
      qc.removeQueries({ queryKey: key });
    };
  }, [qc, summary]);
  if (!ready) return null;
  return <>{children}</>;
}

const meta = {
  title: "App/Dashboard/DashboardPage",
  component: DashboardPage,
  decorators: [withRouter],
} satisfies Meta<typeof DashboardPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Partial success: continue-reading loaded, shelves failed retryably (retry
 * affordance shown), realms failed non-retryably (section hidden, owned by a
 * dedicated hook elsewhere).
 */
export const PartialSuccess: Story = {
  render: () => (
    <StoryHost
      summary={makeSummary({
        continueReading: ok([READING_ITEM]),
        shelves: failed(true),
        realms: failed(false),
      })}
    >
      <DashboardPage />
    </StoryHost>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Loaded section renders its content.
    await waitFor(() =>
      expect(canvas.getByText("War and Peace")).toBeInTheDocument(),
    );
    // Retryable failure offers exactly one retry control.
    expect(canvas.getAllByRole("button")).toHaveLength(1);
  },
};

/** Empty new user: every section loaded but empty; no items, no safety notice. */
export const EmptyNewUser: Story = {
  render: () => (
    <StoryHost summary={makeSummary()}>
      <DashboardPage />
    </StoryHost>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByRole("heading", { level: 1 })).toBeInTheDocument(),
    );
    // No content links and no retry buttons when sections are simply empty.
    expect(canvas.queryAllByRole("link")).toHaveLength(0);
    expect(canvas.queryAllByRole("button")).toHaveLength(0);
  },
};

/** Active reader: continue-reading and shelves populated. */
export const ActiveReader: Story = {
  render: () => (
    <StoryHost
      summary={makeSummary({
        continueReading: ok([READING_ITEM]),
        shelves: ok([SHELF]),
      })}
    >
      <DashboardPage />
    </StoryHost>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByText("War and Peace")).toBeInTheDocument(),
    );
    expect(canvas.getByText("To Read")).toBeInTheDocument();
    // Continue-reading links to the server-chosen node resume route.
    const link = canvas.getByRole("link", { name: /War and Peace/ });
    expect(link).toHaveAttribute("href", "/book/book-1/node/node-3");
  },
};

/** Active community member: realms populated. */
export const ActiveCommunityMember: Story = {
  render: () => (
    <StoryHost
      summary={makeSummary({
        realms: ok([REALM]),
        shelves: ok([SHELF]),
      })}
    >
      <DashboardPage />
    </StoryHost>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByText("Russian Literature")).toBeInTheDocument(),
    );
    const link = canvas.getByRole("link", { name: "Russian Literature" });
    expect(link).toHaveAttribute("href", "/realm/russian-lit");
  },
};

/** Active enforcement: safety section surfaces its notices. */
export const SafetyEnforcement: Story = {
  render: () => (
    <StoryHost
      summary={makeSummary({
        safety: ok({
          enforcementActive: true,
          accountBlocked: false,
          pendingReportsAgainstUser: 1,
          notices: [
            {
              code: "CONTENT_REMOVED",
              message: "A post was removed for violating community rules.",
            },
          ],
        }),
      })}
    >
      <DashboardPage />
    </StoryHost>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(
        canvas.getByText("A post was removed for violating community rules."),
      ).toBeInTheDocument(),
    );
  },
};

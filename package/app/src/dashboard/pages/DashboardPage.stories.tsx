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
// 测试固件
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
  shelfId: "shelf-1",
  title: "To Read",
  itemCount: 12,
  coverUrls: [],
};

const REALM: DashboardRealmSummary = {
  realmId: "realm-1",
  name: "Russian Literature",
  slug: "russian-lit",
};

/**
 * Build a full summary; every section defaults to an empty `ok` value.
 * 构建完整摘要；每个 section 默认为空的 `ok` 值。
 */
function makeSummary(
  overrides: Partial<DashboardSummary> = {},
): DashboardSummary {
  return {
    continueReading: ok([]),
    libraryProgress: ok([]),
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
// Host：将 dashboard 摘要注入 query 缓存，然后渲染真实页面，
// 以便其 loading/error/partial-success 分支都得到演练。
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
 * 部分成功：continue-reading 已加载，shelves 失败但可重试（显示重试控件），
 * realms 失败且不可重试（section 隐藏，由别处的专用 hook 负责）。
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
    // 已加载的 section 渲染其内容。
    await waitFor(() =>
      expect(canvas.getByText("War and Peace")).toBeInTheDocument(),
    );
    // Retryable failure offers exactly one retry control.
    // 可重试的失败恰好提供一个重试控件。
    expect(canvas.getAllByRole("button")).toHaveLength(1);
  },
};

/**
 * Empty new user: every section loaded but empty; no items, no safety notice.
 * 空白新用户：每个 section 都已加载但为空；无条目，无安全提示。
 */
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
    // 当 section 仅仅为空时，不出现内容链接，也不出现重试按钮。
    expect(canvas.queryAllByRole("link")).toHaveLength(0);
    expect(canvas.queryAllByRole("button")).toHaveLength(0);
  },
};

/**
 * Active reader: continue-reading and shelves populated.
 * 活跃读者：continue-reading 与 shelves 均有数据。
 */
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
    // Continue-reading 链接到服务端选定的节点续读路由。
    const link = canvas.getByRole("link", { name: /War and Peace/ });
    expect(link).toHaveAttribute("href", "/book/book-1/node/node-3");
  },
};

/**
 * Active community member: realms populated.
 * 活跃社区成员：realms 有数据。
 */
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

/**
 * Active enforcement: safety section surfaces its notices.
 * 处于执法状态：safety section 显示其提示信息。
 */
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

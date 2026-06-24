import { draftListQuery } from "@rezics/api/draft";
import type { DraftMetadata } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import { expect, waitFor, within } from "storybook/test";
import { withRouter } from "@/stories/decorators/withRouter";
import { DraftsPage } from "./DraftsPage";

const DRAFTS: DraftMetadata[] = [
  {
    id: "post-1",
    kind: "review",
    title: "Thoughts on Dune",
    excerpt: "A sweeping meditation on power and ecology.",
    updatedAt: "2026-05-20T10:00:00.000Z",
    targetUnitId: "book-dune",
    resumeRoute: "/review/post-1/edit",
  },
  {
    id: "post-2",
    kind: "wiki",
    title: "Arrakis",
    updatedAt: "2026-05-18T08:30:00.000Z",
    resumeRoute: "/post/post-2/edit",
  },
];

/**
 * Seed the drafts list into the query cache, then render the real page.
 * 将草稿列表注入查询缓存，然后渲染真实页面。
 */
function StoryHost({
  drafts,
  children,
}: {
  drafts: DraftMetadata[];
  children: ReactNode;
}) {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const key = draftListQuery().queryKey;
    qc.setQueryData(key, { drafts });
    setReady(true);
    return () => {
      qc.removeQueries({ queryKey: key });
    };
  }, [qc, drafts]);
  if (!ready) return null;
  return <>{children}</>;
}

const meta = {
  title: "App/Drafts/DraftsPage",
  component: DraftsPage,
  decorators: [withRouter],
} satisfies Meta<typeof DraftsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Drafts of mixed kinds list with kind labels and resume links.
 * 混合类型的草稿列表，带类型标签和恢复链接。
 */
export const WithDrafts: Story = {
  render: () => (
    <StoryHost drafts={DRAFTS}>
      <DraftsPage />
    </StoryHost>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByText("Thoughts on Dune")).toBeInTheDocument(),
    );
    expect(canvas.getByText("Arrakis")).toBeInTheDocument();
    // Per-kind label (zh-hant default locale): review -> 書評, wiki -> 百科.
    // 按类型的标签（zh-hant 默认 locale）：review -> 書評，wiki -> 百科。
    expect(canvas.getByText("書評")).toBeInTheDocument();
    expect(canvas.getByText("百科")).toBeInTheDocument();
    // The row links to the server-resolved resume route (recover).
    // 该行链接到服务端解析出的恢复路由（recover）。
    const link = canvas.getByText("Thoughts on Dune").closest("a");
    expect(link).toHaveAttribute("href", "/review/post-1/edit");
  },
};

/**
 * No drafts: the list is absent and the empty copy shows.
 * 无草稿：列表不存在，显示空状态文案。
 */
export const Empty: Story = {
  render: () => (
    <StoryHost drafts={[]}>
      <DraftsPage />
    </StoryHost>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByRole("heading")).toBeInTheDocument(),
    );
    expect(canvas.queryByText("Thoughts on Dune")).not.toBeInTheDocument();
  },
};

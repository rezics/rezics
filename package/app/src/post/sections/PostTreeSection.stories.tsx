import { Box } from "@mui/material";
import { postKeys } from "@rezics/api/post/post.keys";
import type { PostDTO } from "@rezics/contract";
import { PostKind } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { PostTreeSection } from "./PostTreeSection";

const ROOT_ID = "fixture-root-1";

function makePost(
  overrides: Partial<PostDTO> & Pick<PostDTO, "unitId" | "depth">,
): PostDTO {
  const nowIso = new Date().toISOString();
  const base = {
    id: overrides.unitId,
    kind: PostKind.POST,
    body: overrides.body ?? "Placeholder reply body for fixture.",
    user: {
      unitId: `u-${overrides.unitId}`,
      name: "Fixture User",
      avatarUrl: undefined,
    },
    targetUnitId: ROOT_ID,
    directReplyCount: 0,
    replyCount: 0,
    reactionSummaries: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  return { ...base, ...overrides } as unknown as PostDTO;
}

const FIXTURE_POSTS: PostDTO[] = [
  makePost({
    unitId: "fix-1",
    depth: 1,
    sortPath: "001",
    directReplyCount: 2,
    body: "Top-level reply with two children.",
  }),
  makePost({
    unitId: "fix-1-1",
    depth: 2,
    sortPath: "001/001",
    parentPostUnitId: "fix-1",
    directReplyCount: 1,
    body: "Depth-2 child, default collapsed.",
  }),
  makePost({
    unitId: "fix-1-1-1",
    depth: 3,
    sortPath: "001/001/001",
    parentPostUnitId: "fix-1-1",
    body: "Deep descendant hidden by default collapse.",
  }),
  makePost({
    unitId: "fix-1-2",
    depth: 2,
    sortPath: "001/002",
    parentPostUnitId: "fix-1",
    body: "Sibling of the first depth-2 node.",
  }),
  makePost({
    unitId: "fix-2",
    depth: 1,
    sortPath: "002",
    body: "Second top-level reply with no children.",
  }),
];

function Seeded() {
  const qc = useQueryClient();
  useEffect(() => {
    qc.setQueryData(
      postKeys.thread(ROOT_ID, { mode: "threaded", maxDepth: 5 }),
      { posts: FIXTURE_POSTS },
    );
  }, [qc]);

  return (
    <Box p={2}>
      <PostTreeSection rootPostUnitId={ROOT_ID} />
    </Box>
  );
}

const meta = {
  title: "App/Post/PostTreeSection",
  component: PostTreeSection,
} satisfies Meta<typeof PostTreeSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Depth3TreeWithDefaultCollapse: Story = {
  render: () => <Seeded />,
};

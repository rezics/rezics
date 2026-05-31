import { postKeys } from "@rezics/api/post/post.keys";
import { markdownContentDoc, type PostDTO, PostKind } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { PostTreeList } from "./PostTreeList";
import { PostTreeSection } from "./PostTreeSection";

const ROOT_ID = "fixture-root-1";

// MOCK: deterministic post fixtures used to seed the React Query cache for stories.
function makePost(
  overrides: Partial<PostDTO> &
    Pick<PostDTO, "unitId" | "depth"> & { contentSource?: string },
): PostDTO {
  const nowIso = new Date().toISOString();
  const { contentSource, ...dtoOverrides } = overrides;
  const base = {
    id: overrides.unitId,
    kind: PostKind.POST,
    content: markdownContentDoc(
      contentSource ?? "Placeholder reply body for fixture.",
    ),
    user: {
      unitId: `u-${overrides.unitId}`,
      name: "Fixture User",
      avatarUrl: undefined,
    },
    targetUnitId: ROOT_ID,
    directReplyCount: 0,
    replyCount: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  return { ...base, ...dtoOverrides } as unknown as PostDTO;
}

const FLAT_POSTS: PostDTO[] = Array.from({ length: 4 }).map((_, i) =>
  makePost({
    unitId: `flat-${i + 1}`,
    depth: 1,
    path: String(i + 1).padStart(4, "0"),
    contentSource: `Top-level reply ${i + 1}.`,
  } as Partial<PostDTO> & Pick<PostDTO, "unitId" | "depth">),
);

const THREADED_3DEEP_POSTS: PostDTO[] = [
  makePost({
    unitId: "fix-1",
    depth: 1,
    path: "0001",
    directReplyCount: 2,
    contentSource: "Top-level reply with two children.",
  } as Partial<PostDTO> & Pick<PostDTO, "unitId" | "depth">),
  makePost({
    unitId: "fix-1-1",
    depth: 2,
    path: "0001.0001",
    parentPostUnitId: "fix-1",
    directReplyCount: 1,
    contentSource: "Depth-2 child, default collapsed.",
  } as Partial<PostDTO> & Pick<PostDTO, "unitId" | "depth">),
  makePost({
    unitId: "fix-1-1-1",
    depth: 3,
    path: "0001.0001.0001",
    parentPostUnitId: "fix-1-1",
    contentSource: "Deep descendant hidden by default collapse.",
  } as Partial<PostDTO> & Pick<PostDTO, "unitId" | "depth">),
  makePost({
    unitId: "fix-1-2",
    depth: 2,
    path: "0001.0002",
    parentPostUnitId: "fix-1",
    contentSource: "Sibling of the first depth-2 node.",
  } as Partial<PostDTO> & Pick<PostDTO, "unitId" | "depth">),
  makePost({
    unitId: "fix-2",
    depth: 1,
    path: "0002",
    contentSource: "Second top-level reply with no children.",
  } as Partial<PostDTO> & Pick<PostDTO, "unitId" | "depth">),
];

function buildDeepThread(depth: number): PostDTO[] {
  const posts: PostDTO[] = [];
  let parent: string | undefined;
  let path = "";
  for (let i = 1; i <= depth; i += 1) {
    const id = `deep-${i}`;
    path = path ? `${path}.0001` : "0001";
    posts.push(
      makePost({
        unitId: id,
        depth: i,
        path: path,
        parentPostUnitId: parent,
        directReplyCount: i < depth ? 1 : 0,
        contentSource: `Depth ${i} reply in 10-deep chain.`,
      } as Partial<PostDTO> & Pick<PostDTO, "unitId" | "depth">),
    );
    parent = id;
  }
  return posts;
}

const THREADED_10DEEP_POSTS = buildDeepThread(10);

const CONTINUOUS_RAIL_POSTS: PostDTO[] = [
  makePost({
    unitId: "outer",
    depth: 1,
    path: "0001",
    directReplyCount: 4,
    contentSource: "Outer reply with several visible children.",
  } as Partial<PostDTO> & Pick<PostDTO, "unitId" | "depth">),
  makePost({
    unitId: "outer-1",
    depth: 2,
    path: "0001.0001",
    parentPostUnitId: "outer",
    contentSource: "First child on the continuous outer rail.",
  } as Partial<PostDTO> & Pick<PostDTO, "unitId" | "depth">),
  makePost({
    unitId: "outer-2",
    depth: 2,
    path: "0001.0002",
    parentPostUnitId: "outer",
    directReplyCount: 1,
    contentSource: "Second child, with a collapsed nested branch.",
  } as Partial<PostDTO> & Pick<PostDTO, "unitId" | "depth">),
  makePost({
    unitId: "outer-2-1",
    depth: 3,
    path: "0001.0002.0001",
    parentPostUnitId: "outer-2",
    contentSource: "Nested child hidden by default collapse.",
  } as Partial<PostDTO> & Pick<PostDTO, "unitId" | "depth">),
  makePost({
    unitId: "outer-3",
    depth: 2,
    path: "0001.0003",
    parentPostUnitId: "outer",
    contentSource: "Third child should not show a rail seam above it.",
  } as Partial<PostDTO> & Pick<PostDTO, "unitId" | "depth">),
  makePost({
    unitId: "outer-4",
    depth: 2,
    path: "0001.0004",
    parentPostUnitId: "outer",
    contentSource: "Last child ends the continuous outer rail.",
  } as Partial<PostDTO> & Pick<PostDTO, "unitId" | "depth">),
];

function Seeded({ posts }: { posts: PostDTO[] }) {
  const qc = useQueryClient();
  useEffect(() => {
    qc.setQueryData(
      postKeys.thread(ROOT_ID, { mode: "threaded", maxDepth: 5 }),
      { posts },
    );
  }, [qc, posts]);

  return (
    <div className="p-4">
      <PostTreeSection rootUnitId={ROOT_ID} />
    </div>
  );
}

const meta = {
  title: "App/Post/PostTreeSection",
  component: PostTreeSection,
  args: {
    rootPostUnitId: ROOT_ID,
  },
} satisfies Meta<typeof PostTreeSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Seeded posts={THREADED_3DEEP_POSTS} />,
};

export const Empty: Story = {
  render: () => <Seeded posts={[]} />,
};

export const Flat: Story = {
  render: () => <Seeded posts={FLAT_POSTS} />,
};

export const Threaded3Deep: Story = {
  render: () => <Seeded posts={THREADED_3DEEP_POSTS} />,
};

export const Threaded10Deep: Story = {
  render: () => <Seeded posts={THREADED_10DEEP_POSTS} />,
};

export const ContinuousOuterRail: Story = {
  render: () => <Seeded posts={CONTINUOUS_RAIL_POSTS} />,
};

export const RoundedRailLab: Story = {
  render: () => (
    <div className="p-4">
      <PostTreeList posts={CONTINUOUS_RAIL_POSTS} rootUnitId={ROOT_ID} />
    </div>
  ),
};

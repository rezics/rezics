import { commentKeys } from "@rezics/api/comment/comment.keys";
import { type CommentDTO, markdownContentDoc } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { PostTreeList } from "./PostTreeList";
import { PostTreeSection } from "./PostTreeSection";

const ROOT_ID = "fixture-root-1";
const REALM_ID = "fixture-realm-1";

// MOCK: deterministic post fixtures used to seed the React Query cache for stories.
function makePost(
  overrides: Partial<CommentDTO> &
    Pick<CommentDTO, "unitId" | "depth"> & { contentSource?: string },
): CommentDTO {
  const nowIso = new Date().toISOString();
  const { contentSource, ...dtoOverrides } = overrides;
  const base = {
    unitId: overrides.unitId,
    rootUnitId: ROOT_ID,
    realmUnitId: REALM_ID,
    parentCommentUnitId: null,
    authorUserId: `u-${overrides.unitId}`,
    content: markdownContentDoc(
      contentSource ?? "Placeholder reply body for fixture.",
    ),
    author: {
      unitId: `u-${overrides.unitId}`,
      name: "Fixture User",
      avatarUrl: undefined,
    },
    directReplyCount: 0,
    replyCount: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  return { ...base, ...dtoOverrides } as unknown as CommentDTO;
}

const FLAT_POSTS: CommentDTO[] = Array.from({ length: 4 }).map((_, i) =>
  makePost({
    unitId: `flat-${i + 1}`,
    depth: 1,
    path: String(i + 1).padStart(4, "0"),
    contentSource: `Top-level reply ${i + 1}.`,
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
);

const THREADED_3DEEP_POSTS: CommentDTO[] = [
  makePost({
    unitId: "fix-1",
    depth: 1,
    path: "0001",
    directReplyCount: 2,
    contentSource: "Top-level reply with two children.",
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
  makePost({
    unitId: "fix-1-1",
    depth: 2,
    path: "0001.0001",
    parentPostUnitId: "fix-1",
    directReplyCount: 1,
    contentSource: "Depth-2 child, default collapsed.",
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
  makePost({
    unitId: "fix-1-1-1",
    depth: 3,
    path: "0001.0001.0001",
    parentPostUnitId: "fix-1-1",
    contentSource: "Deep descendant hidden by default collapse.",
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
  makePost({
    unitId: "fix-1-2",
    depth: 2,
    path: "0001.0002",
    parentPostUnitId: "fix-1",
    contentSource: "Sibling of the first depth-2 node.",
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
  makePost({
    unitId: "fix-2",
    depth: 1,
    path: "0002",
    contentSource: "Second top-level reply with no children.",
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
];

function buildDeepThread(depth: number): CommentDTO[] {
  const posts: CommentDTO[] = [];
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
      } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
    );
    parent = id;
  }
  return posts;
}

const THREADED_10DEEP_POSTS = buildDeepThread(10);

const CONTINUOUS_RAIL_POSTS: CommentDTO[] = [
  makePost({
    unitId: "outer",
    depth: 1,
    path: "0001",
    directReplyCount: 4,
    contentSource: "Outer reply with several visible children.",
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
  makePost({
    unitId: "outer-1",
    depth: 2,
    path: "0001.0001",
    parentPostUnitId: "outer",
    contentSource: "First child on the continuous outer rail.",
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
  makePost({
    unitId: "outer-2",
    depth: 2,
    path: "0001.0002",
    parentPostUnitId: "outer",
    directReplyCount: 1,
    contentSource: "Second child, with a collapsed nested branch.",
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
  makePost({
    unitId: "outer-2-1",
    depth: 3,
    path: "0001.0002.0001",
    parentPostUnitId: "outer-2",
    contentSource: "Nested child hidden by default collapse.",
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
  makePost({
    unitId: "outer-3",
    depth: 2,
    path: "0001.0003",
    parentPostUnitId: "outer",
    contentSource: "Third child should not show a rail seam above it.",
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
  makePost({
    unitId: "outer-4",
    depth: 2,
    path: "0001.0004",
    parentPostUnitId: "outer",
    contentSource: "Last child ends the continuous outer rail.",
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
];

function Seeded({ posts }: { posts: CommentDTO[] }) {
  const qc = useQueryClient();
  useEffect(() => {
    const query = {
      rootUnitId: ROOT_ID,
      realmUnitId: REALM_ID,
      mode: "threaded" as const,
      maxDepth: 5,
      limit: 200,
    };
    const comments: CommentDTO[] = posts.map((post) => ({
      unitId: post.unitId,
      rootUnitId: ROOT_ID,
      realmUnitId: REALM_ID,
      parentCommentUnitId: null,
      authorUserId: post.authorUserId,
      author: post.author,
      content: post.content,
      depth: post.depth ?? 1,
      path: post.path,
      replyCount: post.replyCount,
      directReplyCount: post.directReplyCount,
      lastReplyAt: post.lastReplyAt,
      isLocked: post.isLocked,
      state: post.state,
      pinKind: post.pinKind,
      pinPosition: post.pinPosition,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    }));
    qc.setQueryData(commentKeys.list(query), {
      comments,
      total: comments.length,
    });
  }, [qc, posts]);

  return (
    <div className="p-4">
      <PostTreeSection rootUnitId={ROOT_ID} realmUnitId={REALM_ID} />
    </div>
  );
}

const meta = {
  title: "App/Post/PostTreeSection",
  component: PostTreeSection,
  args: {
    rootUnitId: ROOT_ID,
    realmUnitId: REALM_ID,
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

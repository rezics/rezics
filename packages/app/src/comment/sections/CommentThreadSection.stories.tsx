import { commentKeys } from "@rezics/contract/api/comment/comment.keys";
import {
  type CommentDTO,
  type CommentListContext,
  type CommentSortMode,
  markdownContentDoc,
} from "@rezics/contract";
import { Button } from "@rezics/ui/shadcn";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { CommentReply } from "../components/item/CommentReply";
import { CommentThreadSection } from "./CommentThreadSection";
import { CommentTreeList } from "./CommentTreeList";

const ROOT_ID = "fixture-root-1";
const REALM_ID = "fixture-realm-1";
const REALM_CONTEXT: CommentListContext = {
  kind: "realm",
  realmUnitId: REALM_ID,
};
const COMMENT_SORTS: CommentSortMode[] = [
  "best",
  "top",
  "rising",
  "controversial",
  "new",
  "old",
];

// MOCK: deterministic post fixtures used to seed the React Query cache for stories.
// MOCK: 用于为 stories 填充 React Query 缓存的确定性帖子 fixtures。
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
    parentCommentId: null,
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
    contentSource: `Top-level reply ${i + 1}.`,
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
);

const THREADED_3DEEP_POSTS: CommentDTO[] = [
  makePost({
    unitId: "fix-1",
    depth: 1,
    directReplyCount: 2,
    contentSource: "Top-level reply with two children.",
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
  makePost({
    unitId: "fix-1-1",
    depth: 2,
    parentCommentId: "fix-1",
    directReplyCount: 1,
    contentSource: "Depth-2 child, default collapsed.",
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
  makePost({
    unitId: "fix-1-1-1",
    depth: 3,
    parentCommentId: "fix-1-1",
    contentSource: "Deep descendant hidden by default collapse.",
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
  makePost({
    unitId: "fix-1-2",
    depth: 2,
    parentCommentId: "fix-1",
    contentSource: "Sibling of the first depth-2 node.",
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
  makePost({
    unitId: "fix-2",
    depth: 1,
    contentSource: "Second top-level reply with no children.",
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
];

function buildDeepThread(depth: number): CommentDTO[] {
  const posts: CommentDTO[] = [];
  let parent: string | undefined;
  for (let i = 1; i <= depth; i += 1) {
    const id = `deep-${i}`;
    posts.push(
      makePost({
        unitId: id,
        depth: i,
        parentCommentId: parent,
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
    directReplyCount: 4,
    contentSource: "Outer reply with several visible children.",
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
  makePost({
    unitId: "outer-1",
    depth: 2,
    parentCommentId: "outer",
    contentSource: "First child on the continuous outer rail.",
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
  makePost({
    unitId: "outer-2",
    depth: 2,
    parentCommentId: "outer",
    directReplyCount: 1,
    contentSource: "Second child, with a collapsed nested branch.",
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
  makePost({
    unitId: "outer-2-1",
    depth: 3,
    parentCommentId: "outer-2",
    contentSource: "Nested child hidden by default collapse.",
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
  makePost({
    unitId: "outer-3",
    depth: 2,
    parentCommentId: "outer",
    contentSource: "Third child should not show a rail seam above it.",
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
  makePost({
    unitId: "outer-4",
    depth: 2,
    parentCommentId: "outer",
    contentSource: "Last child ends the continuous outer rail.",
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
];

const REDACTED_PARENT_CONTEXT_POSTS: CommentDTO[] = [
  makePost({
    unitId: "removed-parent",
    depth: 1,
    isRedacted: true,
    moderationStatus: "removed",
    redactionKind: "moderator_removed",
    content: null,
    directReplyCount: 1,
    contentSource: "This body should be redacted.",
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
  makePost({
    unitId: "visible-child",
    depth: 2,
    parentCommentId: "removed-parent",
    contentSource: "Visible child with a removed parent context.",
  } as Partial<CommentDTO> & Pick<CommentDTO, "unitId" | "depth">),
];

function queryDataFor(posts: CommentDTO[], parentContexts: CommentDTO[] = []) {
  return {
    pages: [
      {
        mode: "discovery" as const,
        comments: posts,
        parentContexts,
        nextCursor: null,
        total: posts.length,
      },
    ],
    pageParams: [undefined],
  };
}

function Seeded({
  posts,
  postsBySort,
  parentContexts = [],
}: {
  posts: CommentDTO[];
  postsBySort?: Partial<Record<CommentSortMode, CommentDTO[]>>;
  parentContexts?: CommentDTO[];
}) {
  const qc = useQueryClient();
  useEffect(() => {
    for (const sort of COMMENT_SORTS) {
      const query = {
        rootUnitId: ROOT_ID,
        context: REALM_CONTEXT,
        mode: "discovery" as const,
        sort,
        limit: 50,
      };
      qc.setQueryData(
        commentKeys.list(query),
        queryDataFor(postsBySort?.[sort] ?? posts, parentContexts),
      );
    }
  }, [parentContexts, posts, postsBySort, qc]);

  return (
    <div className="p-4">
      <CommentThreadSection
        rootUnitId={ROOT_ID}
        defaultContext={REALM_CONTEXT}
      />
    </div>
  );
}

function RootEntryPreview({
  rootComment,
  childComments,
  hasMore = false,
}: {
  rootComment: CommentDTO;
  childComments: CommentDTO[];
  hasMore?: boolean;
}) {
  return (
    <div className="w-full mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <CommentReply post={rootComment} />
      <CommentTreeList
        posts={childComments}
        rootUnitId={ROOT_ID}
        baseDepth={rootComment.depth ?? 0}
      />
      {hasMore ? (
        <div className="flex justify-center pt-2">
          <Button type="button" variant="outline" size="sm">
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const meta = {
  title: "App/Comment/CommentThreadSection",
  component: CommentThreadSection,
  args: {
    rootUnitId: ROOT_ID,
    defaultContext: REALM_CONTEXT,
  },
} satisfies Meta<typeof CommentThreadSection>;

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

export const DiscoveryParentContext: Story = {
  render: () => (
    <Seeded
      posts={[REDACTED_PARENT_CONTEXT_POSTS[1]!]}
      parentContexts={[REDACTED_PARENT_CONTEXT_POSTS[0]!]}
    />
  ),
};

export const RootCommentEntry: Story = {
  render: () => (
    <RootEntryPreview
      rootComment={THREADED_3DEEP_POSTS[0]!}
      childComments={THREADED_3DEEP_POSTS.slice(1)}
      hasMore
    />
  ),
};

export const DirectChildExpansion: Story = {
  render: () => (
    <RootEntryPreview
      rootComment={CONTINUOUS_RAIL_POSTS[0]!}
      childComments={CONTINUOUS_RAIL_POSTS.slice(1)}
    />
  ),
};

export const SortSwitching: Story = {
  render: () => (
    <Seeded
      posts={THREADED_3DEEP_POSTS}
      postsBySort={{
        best: THREADED_3DEEP_POSTS,
        top: [...THREADED_3DEEP_POSTS].reverse(),
        rising: [THREADED_3DEEP_POSTS[1]!, THREADED_3DEEP_POSTS[0]!],
        controversial: [THREADED_3DEEP_POSTS[2]!, THREADED_3DEEP_POSTS[0]!],
        new: [THREADED_3DEEP_POSTS[4]!, THREADED_3DEEP_POSTS[0]!],
        old: [THREADED_3DEEP_POSTS[0]!, THREADED_3DEEP_POSTS[4]!],
      }}
    />
  ),
};

export const RoundedRailLab: Story = {
  render: () => (
    <div className="p-4">
      <CommentTreeList posts={CONTINUOUS_RAIL_POSTS} rootUnitId={ROOT_ID} />
    </div>
  ),
};

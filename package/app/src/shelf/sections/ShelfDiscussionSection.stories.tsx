import { postKeys } from "@rezics/api/post/post.keys";
import { markdownContentDoc, type PostDTO, PostKind } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useAuthSessionStore } from "@/user/states";

import { ShelfDiscussionSection } from "./ShelfDiscussionSection";

const SHELF_ID = "fixture-shelf-1";
const SHELF_POST_FILTERS = {
  kind: undefined,
  limit: 20,
  parentPostUnitId: undefined,
};

function makePost(
  overrides: Partial<PostDTO> &
    Pick<PostDTO, "unitId" | "depth"> & { contentSource?: string },
): PostDTO {
  const nowIso = new Date().toISOString();
  const { contentSource, ...dtoOverrides } = overrides;
  const base = {
    id: overrides.unitId,
    kind: PostKind.POST,
    content: markdownContentDoc(contentSource ?? "Fixture comment."),
    user: {
      unitId: `u-${overrides.unitId}`,
      name: "Fixture User",
      avatarUrl: undefined,
    },
    targetUnitId: SHELF_ID,
    directReplyCount: 0,
    replyCount: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  return { ...base, ...dtoOverrides } as unknown as PostDTO;
}

const POPULATED_POSTS: PostDTO[] = [
  makePost({
    unitId: "shelf-p1",
    depth: 1,
    sortPath: "0001",
    contentSource:
      "Really nice curation! Any chance you'll add the second series?",
  }),
  makePost({
    unitId: "shelf-p2",
    depth: 1,
    sortPath: "0002",
    contentSource: "Love the range here — thanks for sharing.",
  }),
];

const MANY_POSTS: PostDTO[] = Array.from({ length: 12 }).map((_, i) =>
  makePost({
    unitId: `shelf-many-${i + 1}`,
    depth: 1,
    sortPath: String(i + 1).padStart(4, "0"),
    contentSource: `Comment ${i + 1}: thoughtful note about the curation choices.`,
  } as Partial<PostDTO> & Pick<PostDTO, "unitId" | "depth">),
);

// MOCK: story-only auth state override so Storybook can demo signed-out path.
function useMockAuthed(authed: boolean) {
  useEffect(() => {
    useAuthSessionStore.setState({
      auth: {
        session: null,
        user: null,
        role: null,
        hasIdentity: authed,
      },
      rezics: {
        userId: authed ? "story-user" : null,
        permission: authed ? { role: "MEMBER" } : null,
        hasMemberSession: authed,
        hasProfileSetupSession: false,
        mainUserExists: authed,
      },
      registration: {
        stage: authed ? "complete" : "anonymous",
        emailVerified: authed,
        complete: authed,
        needsVerification: false,
        needsMainSetup: false,
      },
      capabilityLevel: authed ? "member" : "anonymous",
      status: "ready",
    });
  }, [authed]);
}

function SeededAuthedEmpty() {
  const qc = useQueryClient();
  useMockAuthed(true);
  useEffect(() => {
    qc.setQueryData(postKeys.byTarget(SHELF_ID, SHELF_POST_FILTERS), {
      posts: [],
    });
  }, [qc]);
  return (
    <div className="p-4">
      <ShelfDiscussionSection shelfUnitId={SHELF_ID} />
    </div>
  );
}

function SeededAuthedPopulated() {
  const qc = useQueryClient();
  useMockAuthed(true);
  useEffect(() => {
    qc.setQueryData(postKeys.byTarget(SHELF_ID, SHELF_POST_FILTERS), {
      posts: POPULATED_POSTS,
    });
  }, [qc]);
  return (
    <div className="p-4">
      <ShelfDiscussionSection shelfUnitId={SHELF_ID} />
    </div>
  );
}

function SeededAuthedMany() {
  const qc = useQueryClient();
  useMockAuthed(true);
  useEffect(() => {
    qc.setQueryData(postKeys.byTarget(SHELF_ID, SHELF_POST_FILTERS), {
      posts: MANY_POSTS,
    });
  }, [qc]);
  return (
    <div className="p-4">
      <ShelfDiscussionSection shelfUnitId={SHELF_ID} />
    </div>
  );
}

function SeededUnauthenticated() {
  const qc = useQueryClient();
  useMockAuthed(false);
  useEffect(() => {
    qc.setQueryData(postKeys.byTarget(SHELF_ID, SHELF_POST_FILTERS), {
      posts: POPULATED_POSTS,
    });
  }, [qc]);
  return (
    <div className="p-4">
      <ShelfDiscussionSection shelfUnitId={SHELF_ID} />
    </div>
  );
}

const meta = {
  title: "App/Shelf/ShelfDiscussionSection",
  component: ShelfDiscussionSection,
} satisfies Meta<typeof ShelfDiscussionSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <SeededAuthedPopulated />,
};

export const Empty: Story = {
  render: () => <SeededAuthedEmpty />,
};

export const Many: Story = {
  render: () => <SeededAuthedMany />,
};

export const Disabled: Story = {
  name: "Disabled (signed-out)",
  render: () => <SeededUnauthenticated />,
};

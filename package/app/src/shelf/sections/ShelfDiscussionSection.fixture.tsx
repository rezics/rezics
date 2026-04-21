import { Box } from "@mui/material";
import { postKeys } from "@rezics/api/post/post.keys";
import type { PostDTO } from "@rezics/contract";
import { PostKind } from "@rezics/contract";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuthSessionStore } from "@/user/states";
import { ShelfDiscussionSection } from "./ShelfDiscussionSection";

const SHELF_ID = "fixture-shelf-1";

function makePost(
  overrides: Partial<PostDTO> & Pick<PostDTO, "unitId" | "depth">,
): PostDTO {
  const nowIso = new Date().toISOString();
  const base = {
    id: overrides.unitId,
    kind: PostKind.POST,
    body: overrides.body ?? "Fixture comment.",
    user: {
      unitId: `u-${overrides.unitId}`,
      name: "Fixture User",
      avatarUrl: undefined,
    },
    targetUnitId: SHELF_ID,
    directReplyCount: 0,
    replyCount: 0,
    reactionSummaries: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  return { ...base, ...overrides } as unknown as PostDTO;
}

const POPULATED_POSTS: PostDTO[] = [
  makePost({
    unitId: "shelf-p1",
    depth: 1,
    sortPath: "001",
    body: "Really nice curation! Any chance you'll add the second series?",
  }),
  makePost({
    unitId: "shelf-p2",
    depth: 1,
    sortPath: "002",
    body: "Love the range here — thanks for sharing.",
  }),
];

// MOCK: fixture-only auth state override so Cosmos can demo signed-out path.
function useMockAuthed(authed: boolean) {
  useEffect(() => {
    useAuthSessionStore.setState({
      // biome-ignore lint/suspicious/noExplicitAny: fixture mock override
      permission: (authed ? "member" : null) as any,
      status: "ready",
    });
  }, [authed]);
}

function SeededAuthedEmpty() {
  const qc = useQueryClient();
  useMockAuthed(true);
  useEffect(() => {
    qc.setQueryData(
      postKeys.thread(SHELF_ID, { mode: "threaded", maxDepth: 5 }),
      { posts: [] },
    );
  }, [qc]);
  return (
    <Box p={2}>
      <ShelfDiscussionSection shelfUnitId={SHELF_ID} />
    </Box>
  );
}

function SeededAuthedPopulated() {
  const qc = useQueryClient();
  useMockAuthed(true);
  useEffect(() => {
    qc.setQueryData(
      postKeys.thread(SHELF_ID, { mode: "threaded", maxDepth: 5 }),
      { posts: POPULATED_POSTS },
    );
  }, [qc]);
  return (
    <Box p={2}>
      <ShelfDiscussionSection shelfUnitId={SHELF_ID} />
    </Box>
  );
}

function SeededUnauthenticated() {
  const qc = useQueryClient();
  useMockAuthed(false);
  useEffect(() => {
    qc.setQueryData(
      postKeys.thread(SHELF_ID, { mode: "threaded", maxDepth: 5 }),
      { posts: POPULATED_POSTS },
    );
  }, [qc]);
  return (
    <Box p={2}>
      <ShelfDiscussionSection shelfUnitId={SHELF_ID} />
    </Box>
  );
}

export default {
  "empty (signed in)": () => <SeededAuthedEmpty />,
  "populated (signed in)": () => <SeededAuthedPopulated />,
  "unauthenticated sign-in prompt": () => <SeededUnauthenticated />,
};

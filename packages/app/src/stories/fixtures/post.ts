// MOCK: Storybook post fixtures, hand-authored against `PostDTO`.
// MOCK：Storybook 帖子夹具，手工依据 `PostDTO` 编写。
import { markdownContentDoc, type PostDTO } from "@rezics/contract";
import { userAlice, userBen, userCora } from "./user.ts";

type PostFixtureOverrides = Partial<PostDTO> & {
  unitId: string;
  contentSource?: string;
};

function makePost(overrides: PostFixtureOverrides): PostDTO {
  const { contentSource, ...dtoOverrides } = overrides;
  const content = markdownContentDoc(
    contentSource ?? "A short reflection that fits in a single line.",
  );
  return {
    unitId: overrides.unitId,
    authorUserId: overrides.authorUserId ?? userAlice.unitId,
    author: overrides.author ?? userAlice,
    resolvedLanguage: "en",
    content,
    depth: 0,
    replyCount: 0,
    directReplyCount: 0,
    isLocked: false,
    createdAt: "2024-04-12T09:00:00.000Z",
    updatedAt: "2024-04-12T09:00:00.000Z",
    ...dtoOverrides,
  } as PostDTO;
}

export const postFlat: PostDTO[] = [
  makePost({
    unitId: "post-flat-1",
    contentSource:
      "Started this on a flight and finished before landing — a rare gift.",
    replyCount: 3,
  }),
  makePost({
    unitId: "post-flat-2",
    author: userBen,
    authorUserId: userBen.unitId,
    contentSource: "Disagree on the ending, but the prose is undeniable.",
    replyCount: 1,
  }),
  makePost({
    unitId: "post-flat-3",
    author: userCora,
    authorUserId: userCora.unitId,
    contentSource: "Will re-read in a year and revisit this thread.",
  }),
];

export const postLongBody: PostDTO = makePost({
  unitId: "post-long",
  contentSource: `The novel's real subject is the slow drift between two lives.\n\nIts middle section reads like a single long sentence broken across forty pages — every paragraph is a clause; every page a held breath. By the time the protagonists meet again the reader has aged with them. I don't know any other book that earns its quiet ending so honestly.\n\nA second reading rewards the patient. The minor characters in chapters 3 and 11 mirror each other almost verbatim — but with the speakers swapped. It's not a trick. It's an argument about how we talk past the people we love.`,
  replyCount: 12,
  directReplyCount: 5,
});

export const postEmpty: PostDTO[] = [];

export const postCJK: PostDTO = makePost({
  unitId: "post-cjk",
  contentSource:
    "整本書最動人的是那個被推遲的告別——我們以為理解了主角，其實是書終於理解了我們。",
});

export const postLatin: PostDTO = makePost({
  unitId: "post-latin",
  contentSource:
    "What surprised me was how the author trusts the reader to assemble the timeline. The novel doesn't explain itself; it waits.",
});

function buildThreaded(maxDepth: number): PostDTO[] {
  const posts: PostDTO[] = [];
  for (let depth = 0; depth <= maxDepth; depth += 1) {
    posts.push(
      makePost({
        unitId: `post-threaded-${maxDepth}d-${depth}`,
        author: depth % 2 === 0 ? userAlice : userBen,
        authorUserId: depth % 2 === 0 ? userAlice.unitId : userBen.unitId,
        depth,
        parentPostUnitId:
          depth === 0 ? null : `post-threaded-${maxDepth}d-${depth - 1}`,
        rootPostUnitId: `post-threaded-${maxDepth}d-0`,
        contentSource:
          depth === 0
            ? "Top of the thread — first impression."
            : `Reply at depth ${depth}: a follow-up thought.`,
        replyCount: depth === maxDepth ? 0 : 1,
        directReplyCount: depth === maxDepth ? 0 : 1,
      }),
    );
  }
  return posts;
}

export const postThreaded3deep: PostDTO[] = buildThreaded(3);
export const postThreaded10deep: PostDTO[] = buildThreaded(10);

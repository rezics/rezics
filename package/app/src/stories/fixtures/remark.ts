// MOCK: Storybook remark fixtures, hand-authored against `PostDTO` (remarks are
// posts of kind=REMARK).
import type { PostDTO } from "@rezics/contract";
import { userAlice, userBen, userCora } from "./user.ts";

function makeRemark(overrides: Partial<PostDTO> & { unitId: string }): PostDTO {
  return {
    unitId: overrides.unitId,
    authorUserId: userAlice.unitId,
    author: userAlice,
    kind: "REMARK",
    body: "A short note: chapter 3's pacing reminded me of Carver.",
    replyCount: 0,
    directReplyCount: 0,
    createdAt: "2024-04-12T11:00:00.000Z",
    updatedAt: "2024-04-12T11:00:00.000Z",
    reactionSummaries: [],
    ...overrides,
  } as PostDTO;
}

export const remarkShort: PostDTO = makeRemark({ unitId: "remark-short" });

export const remarkLong: PostDTO = makeRemark({
  unitId: "remark-long",
  body: `A few quick notes from tonight's reading:\n\n- The dialogue in chapter 5 is doing more work than it announces.\n- I keep marking the same sentence on every reread; you'll know which one when you get there.\n- The translator's note at the back is itself a small essay; don't skip it.`,
});

export const remarkCJK: PostDTO = makeRemark({
  unitId: "remark-cjk",
  author: userBen,
  authorUserId: userBen.unitId,
  body: "第三章的節奏讓我想起卡佛——同樣是用沉默推動的。",
});

export const remarkLatin: PostDTO = makeRemark({
  unitId: "remark-latin",
  author: userCora,
  authorUserId: userCora.unitId,
  body: "Short and good — the kind of book you keep in your bag for the bus.",
});

export const remarkList: PostDTO[] = [
  remarkShort,
  remarkLong,
  remarkCJK,
  remarkLatin,
];

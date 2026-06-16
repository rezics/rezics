// MOCK: Storybook remark fixtures, hand-authored against `PostDTO` (remarks are
// posts of kind=REMARK).
// MOCK：Storybook 短评夹具，手工依据 `PostDTO` 编写（短评是 kind=REMARK 的帖子）。
import { markdownContentDoc, type PostDTO } from "@rezics/contract";
import { userAlice, userBen, userCora } from "./user.ts";

type RemarkFixtureOverrides = Partial<PostDTO> & {
  unitId: string;
  contentSource?: string;
};

function makeRemark(overrides: RemarkFixtureOverrides): PostDTO {
  const { contentSource, ...dtoOverrides } = overrides;
  return {
    unitId: overrides.unitId,
    authorUserId: userAlice.unitId,
    author: userAlice,
    kind: "REMARK",
    content: markdownContentDoc(
      contentSource ??
        "A short note: chapter 3's pacing reminded me of Carver.",
    ),
    replyCount: 0,
    directReplyCount: 0,
    createdAt: "2024-04-12T11:00:00.000Z",
    updatedAt: "2024-04-12T11:00:00.000Z",
    ...dtoOverrides,
  } as PostDTO;
}

export const remarkShort: PostDTO = makeRemark({ unitId: "remark-short" });

export const remarkLong: PostDTO = makeRemark({
  unitId: "remark-long",
  contentSource: `A few quick notes from tonight's reading:\n\n- The dialogue in chapter 5 is doing more work than it announces.\n- I keep marking the same sentence on every reread; you'll know which one when you get there.\n- The translator's note at the back is itself a small essay; don't skip it.`,
});

export const remarkCJK: PostDTO = makeRemark({
  unitId: "remark-cjk",
  author: userBen,
  authorUserId: userBen.unitId,
  contentSource: "第三章的節奏讓我想起卡佛——同樣是用沉默推動的。",
});

export const remarkLatin: PostDTO = makeRemark({
  unitId: "remark-latin",
  author: userCora,
  authorUserId: userCora.unitId,
  contentSource:
    "Short and good — the kind of book you keep in your bag for the bus.",
});

export const remarkList: PostDTO[] = [
  remarkShort,
  remarkLong,
  remarkCJK,
  remarkLatin,
];

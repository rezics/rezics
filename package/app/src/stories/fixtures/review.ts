// MOCK: Storybook review fixtures, hand-authored against `PostDTO` (reviews are
// posts of kind=REVIEW).
import type { PostDTO } from "@rezics/contract";
import { userAlice, userBen } from "./user.ts";

function makeReview(overrides: Partial<PostDTO> & { unitId: string }): PostDTO {
  return {
    unitId: overrides.unitId,
    authorUserId: userAlice.unitId,
    author: userAlice,
    kind: "REVIEW",
    body: "An honest, generous read — flawed in places, but unforgettable.",
    extra: {
      title: "A small triumph",
      rating: 4.5,
      book: {
        title: "The Quiet Library",
        coverUrl: "https://picsum.photos/seed/review-cover/120/180",
      },
    },
    replyCount: 5,
    directReplyCount: 3,
    createdAt: "2024-04-12T09:00:00.000Z",
    updatedAt: "2024-04-12T09:00:00.000Z",
    ...overrides,
  } as PostDTO;
}

export const reviewShort: PostDTO = makeReview({ unitId: "review-short" });

export const reviewLong: PostDTO = makeReview({
  unitId: "review-long",
  body: `Reading this twice changed my mind on the ending.\n\nThe final chapter is not the climax — chapter 17 is, and you can't see it on the first pass because the author refuses to flag it. The pleasure of a second reading is watching the architecture reveal itself.\n\nA short bibliography of companion essays appears in the back matter; if you only read one, choose Tanaka's "On Quiet Endings."`,
  extra: {
    title: "Quiet endings, second readings",
    rating: 5,
    book: {
      title: "The Quiet Library",
      coverUrl: "https://picsum.photos/seed/review-cover/120/180",
    },
  },
});

export const reviewCJK: PostDTO = makeReview({
  unitId: "review-cjk",
  author: userBen,
  authorUserId: userBen.unitId,
  body: "讀第二次才發現結局並非高潮——第十七章才是，作者刻意不提示，這正是它最動人的地方。",
  extra: {
    title: "重讀的喜悅",
    rating: 5,
    book: {
      title: "靜默圖書館",
      coverUrl: "https://picsum.photos/seed/review-cover-cjk/120/180",
    },
  },
});

export const reviewLatin: PostDTO = makeReview({
  unitId: "review-latin",
  body: "What surprised me on the second reading was how the small chapters mirror each other across hundreds of pages. The novel rewards re-reading; once you see the pattern, it never goes away.",
});

export const reviewList: PostDTO[] = [
  reviewShort,
  reviewLong,
  reviewCJK,
  reviewLatin,
];

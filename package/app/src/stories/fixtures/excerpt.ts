// MOCK: Storybook excerpt fixtures, hand-authored against `UnitDTO`.
// MOCK: 针对 `UnitDTO` 手工编写的 Storybook excerpt fixtures。
import type { UnitDTO } from "@rezics/contract";
import { LANGUAGES } from "@rezics/contract";
import { userAlice, userBen } from "./user.ts";

function makeExcerpt(overrides: Partial<UnitDTO> & { id: string }): UnitDTO {
  return {
    id: overrides.id,
    type: "EXCERPT",
    user: userAlice,
    userId: userAlice.unitId,
    defaultLanguage: LANGUAGES.EN,
    extra: {
      source: { title: "The Quiet Library, ch. 4" },
    },
    translations: [
      {
        unitId: overrides.id,
        language: LANGUAGES.EN,
        description:
          "A library is a collection of possible futures, arranged on shelves we may never reach.",
      },
    ],
    createdAt: "2024-04-12T10:00:00.000Z",
    updatedAt: "2024-04-12T10:00:00.000Z",
    ...overrides,
  } as UnitDTO;
}

export const excerptShort: UnitDTO = makeExcerpt({ id: "excerpt-short" });

export const excerptLong: UnitDTO = makeExcerpt({
  id: "excerpt-long",
  translations: [
    {
      unitId: "excerpt-long",
      language: LANGUAGES.EN,
      description:
        "She walked the length of the room three times before pulling a book from the shelf, and that book — the one she didn't recognise — became, in the long minutes that followed, the room itself: every chair, every fading rug, every blue inch of light through the high windows arranged itself around the page until what she'd come for and what she found could no longer be told apart.",
    },
  ],
});

export const excerptCJK: UnitDTO = makeExcerpt({
  id: "excerpt-cjk",
  user: userBen,
  userId: userBen.unitId,
  defaultLanguage: LANGUAGES.ZH_HANT,
  translations: [
    {
      unitId: "excerpt-cjk",
      language: LANGUAGES.ZH_HANT,
      description:
        "她在房間裡走了三圈，才從架上抽出一本書；接下來的長時間裡，那本她不認得的書成為了整個房間。",
    },
  ],
  extra: {
    source: { title: "靜默圖書館，第四章" },
  },
});

export const excerptLatin: UnitDTO = makeExcerpt({ id: "excerpt-latin" });

export const excerptList: UnitDTO[] = [
  excerptShort,
  excerptLong,
  excerptCJK,
  excerptLatin,
];

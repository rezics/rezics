import type { AboutLibraryPageId, AboutLocale } from "./locales";
import type { AboutHeroCopy, AboutPageMeta } from "./types";

export type LibraryPageCopy = {
  hero: AboutHeroCopy;
  meta: AboutPageMeta;
};

const libraryCopyByLocale = {
  "zh-hant": {
    game: {
      hero: { eyebrow: "Library", heading: "遊戲庫" },
      meta: {
        title: "遊戲庫 | Rezics",
        description: "Rezics 遊戲庫入口。",
      },
    },
    media: {
      hero: { eyebrow: "Library", heading: "媒體庫" },
      meta: {
        title: "媒體庫 | Rezics",
        description: "Rezics 媒體庫入口。",
      },
    },
  },
  "zh-hans": {
    game: {
      hero: { eyebrow: "Library", heading: "游戏库" },
      meta: {
        title: "游戏库 | Rezics",
        description: "Rezics 游戏库入口。",
      },
    },
    media: {
      hero: { eyebrow: "Library", heading: "媒体库" },
      meta: {
        title: "媒体库 | Rezics",
        description: "Rezics 媒体库入口。",
      },
    },
  },
  en: {
    game: {
      hero: { eyebrow: "Library", heading: "Game Library" },
      meta: {
        title: "Game Library | Rezics",
        description: "Rezics game library entry.",
      },
    },
    media: {
      hero: { eyebrow: "Library", heading: "Media Library" },
      meta: {
        title: "Media Library | Rezics",
        description: "Rezics media library entry.",
      },
    },
  },
  ja: {
    game: {
      hero: { eyebrow: "Library", heading: "ゲームライブラリ" },
      meta: {
        title: "ゲームライブラリ | Rezics",
        description: "Rezics ゲームライブラリの入口。",
      },
    },
    media: {
      hero: { eyebrow: "Library", heading: "メディアライブラリ" },
      meta: {
        title: "メディアライブラリ | Rezics",
        description: "Rezics メディアライブラリの入口。",
      },
    },
  },
  de: {
    game: {
      hero: { eyebrow: "Library", heading: "Spielebibliothek" },
      meta: {
        title: "Spielebibliothek | Rezics",
        description: "Einstieg in die Rezics-Spielebibliothek.",
      },
    },
    media: {
      hero: { eyebrow: "Library", heading: "Mediathek" },
      meta: {
        title: "Mediathek | Rezics",
        description: "Einstieg in die Rezics-Mediathek.",
      },
    },
  },
  ko: {
    game: {
      hero: { eyebrow: "Library", heading: "게임 라이브러리" },
      meta: {
        title: "게임 라이브러리 | Rezics",
        description: "Rezics 게임 라이브러리 입구입니다.",
      },
    },
    media: {
      hero: { eyebrow: "Library", heading: "미디어 라이브러리" },
      meta: {
        title: "미디어 라이브러리 | Rezics",
        description: "Rezics 미디어 라이브러리 입구입니다.",
      },
    },
  },
} as const satisfies Record<
  AboutLocale,
  Record<AboutLibraryPageId, LibraryPageCopy>
>;

export function getLibraryPageCopy(
  locale: AboutLocale,
  page: AboutLibraryPageId,
): LibraryPageCopy {
  return libraryCopyByLocale[locale][page];
}

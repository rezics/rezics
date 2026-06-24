import { describe, expect, test } from "bun:test";
import { detectContentLanguage } from "./content-language-detection";

describe("detectContentLanguage", () => {
  test("ignores short text", () => {
    expect(detectContentLanguage("short text")).toBeNull();
  });

  test("detects broad content languages", () => {
    expect(
      detectContentLanguage(
        "This is a plain English sentence about books, games, language, catalog search, and community discussions.",
      )?.language,
    ).toBe("en");
    expect(
      detectContentLanguage(
        "Esta es una frase clara en español sobre libros, juegos, idiomas, búsqueda de catálogo y conversaciones de comunidad.",
      )?.language,
    ).toBe("es");
  });

  test("uses Chinese script hints for franc-min Mandarin", () => {
    expect(
      detectContentLanguage(
        "這是一段繁體中文內容，討論書籍、遊戲、語言、目錄搜尋與社群交流。",
      )?.language,
    ).toBe("zh-hant");
  });
});

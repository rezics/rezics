import { beforeAll, describe, expect, it, mock } from "bun:test";
import i18next from "i18next";

// The chip builder resolves labels through the shared i18n runtime. Provide a
// backend-free i18next instance (inline `en` resources, synchronous init) and
// mock the runtime module so labels resolve without any network fetch.
// chip 构建器通过共享的 i18n 运行时解析标签。提供一个无后端的 i18next 实例
//（内联 `en` 资源、同步初始化），并 mock 该运行时模块，使标签无需任何网络请求即可解析。
const i18n = i18next.createInstance();
i18n.init({
  lng: "en",
  initImmediate: false,
  interpolation: { prefix: "{", suffix: "}", escapeValue: false },
  resources: {
    en: {
      search: {
        chip_type: "Type: {value}",
        chip_rating: "Rating: {value}",
        chip_licensed: "Licensed: {value}",
        chip_words: "Words: {value}",
        chip_sort: "Sort: {value}",
      },
      common: { yes: "Yes", no: "No" },
    },
  },
});

mock.module("@rezics/i18n/runtime", () => ({
  getI18nRuntime: () => ({ i18n }),
  createI18nRuntime: () => ({ i18n, ready: Promise.resolve(i18n) }),
}));

let buildAppliedFilterChips: typeof import("./chipDescriptors").buildAppliedFilterChips;

beforeAll(async () => {
  ({ buildAppliedFilterChips } = await import("./chipDescriptors"));
});

describe("buildAppliedFilterChips", () => {
  it("renders one chip per user tag", () => {
    const chips = buildAppliedFilterChips({
      tags: [{ slug: "a" }, { slug: "b" }],
    });
    expect(chips.map((c) => c.key)).toEqual(["tag:a", "tag:b"]);
  });

  it("hides tags present in `hide`", () => {
    const chips = buildAppliedFilterChips(
      { tags: [{ slug: "a" }, { slug: "b" }] },
      { tags: [{ slug: "a" }] },
    );
    expect(chips.map((c) => c.key)).toEqual(["tag:b"]);
  });

  it("suppresses fields listed in `rendered`", () => {
    const chips = buildAppliedFilterChips(
      { keyword: "foo", tags: [{ slug: "a" }] },
      {},
      ["keyword"],
    );
    expect(chips.find((c) => c.key.startsWith("keyword"))).toBeUndefined();
    expect(chips.find((c) => c.key === "tag:a")).toBeDefined();
  });

  it("renders rating & licensed & sort chips when not hidden or rendered", () => {
    const chips = buildAppliedFilterChips({
      ratings: ["R_18"],
      isLicensed: false,
      sort: "createdAt",
    });
    expect(chips.find((c) => c.key === "rating:R_18")).toBeDefined();
    expect(chips.find((c) => c.key.startsWith("licensed"))).toBeDefined();
    expect(chips.find((c) => c.key.startsWith("sort"))).toBeDefined();
  });

  it("renders textLength range chip", () => {
    const chips = buildAppliedFilterChips({
      textLength: { min: 100, max: 500 },
    });
    const chip = chips.find((c) => c.key.startsWith("textLength"));
    expect(chip?.label).toBe("Words: 100–500");
  });

  it("hides realm when implicit realm matches", () => {
    const chips = buildAppliedFilterChips(
      { realm: { scope: "realm", slug: "zone1" } },
      { realm: { scope: "realm", slug: "zone1" } },
    );
    expect(chips.find((c) => c.key.startsWith("realm"))).toBeUndefined();
  });

  it("remove patch for tag drops only that slug", () => {
    const chips = buildAppliedFilterChips({
      tags: [{ slug: "a" }, { slug: "b" }],
    });
    const chipA = chips.find((c) => c.key === "tag:a");
    expect(chipA?.remove).toEqual({ tags: [{ slug: "b" }] });
  });
});

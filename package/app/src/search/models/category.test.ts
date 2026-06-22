import { SEARCH_CATEGORIES } from "@rezics/contract";
import { describe, expect, test } from "bun:test";
import { ALL_CATEGORIES } from "../components/permittedCategories";
import { isSearchCategory } from "./category";

// Locks the search UI's category list to the contract. Before this round the
// app kept two hand-copied `SearchCategory[]` literals; the reference-identity
// assertion fails against a copy and only passes when the app imports the
// contract's `SEARCH_CATEGORIES` — making contract drift structurally
// impossible (a new category can never silently vanish from search).
// 把搜索 UI 的分类列表锁定到契约。本局之前 app 维护了两份手抄
// `SearchCategory[]` 字面量；引用同一性断言对副本必挂，只有当 app 导入契约的
// `SEARCH_CATEGORIES` 时才过——使契约漂移在结构上不可能（新分类绝不会从搜索
// 里静默消失）。
describe("search category list stays bound to the contract", () => {
  test("ALL_CATEGORIES is the contract list itself, not a copy", () => {
    expect(ALL_CATEGORIES).toBe(SEARCH_CATEGORIES);
  });

  test("isSearchCategory accepts every contract category and rejects non-members", () => {
    for (const category of SEARCH_CATEGORIES) {
      expect(isSearchCategory(category)).toBe(true);
    }
    expect(isSearchCategory("not-a-category")).toBe(false);
    expect(isSearchCategory(undefined)).toBe(false);
  });
});

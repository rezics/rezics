import type { StreamSort } from "@rezics/contract";

// Single source of truth for the stream sort control, shared by the home stream
// and every realm stream. Anchored to the contract `StreamSort` union so a new
// sort added in the contract surfaces here at compile time instead of silently
// drifting per consumer.
// 流排序控件的单一事实来源，首页流与所有 realm 流共用。锚定契约 `StreamSort`，
// 契约新增排序档位时此处编译期暴露，而非各消费点静默漂移。

/** Display order of the sort options. Each entry is validated against the contract. */
/** 排序选项的展示顺序；每一项都按契约校验。 */
export const STREAM_SORT_OPTIONS = [
  "best",
  "hot",
  "new",
  "top",
  "rising",
] as const satisfies readonly StreamSort[];

/**
 * Fully-qualified i18n key per sort option. `satisfies Record<StreamSort, …>`
 * forces this map to stay exhaustive: adding a contract sort without a key here
 * is a type error.
 * 每个排序选项的完整 i18n 键。`satisfies Record<StreamSort, …>` 强制其穷尽——
 * 契约新增排序却不在此补键即类型报错。
 */
export const STREAM_SORT_I18N_KEY = {
  best: "entity:stream_sort_best",
  hot: "entity:stream_sort_hot",
  new: "entity:stream_sort_new",
  top: "entity:stream_sort_top",
  rising: "entity:stream_sort_rising",
} as const satisfies Record<StreamSort, string>;

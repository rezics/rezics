import { describe, expect, test } from "bun:test";
import { streamSortSchema } from "@rezics/contract";
import { STREAM_SORT_I18N_KEY, STREAM_SORT_OPTIONS } from "./streamSort";

// The contract schema is the authority. We read its literal members at runtime
// (TypeBox unions expose `anyOf: [{ const }]`) and assert the shared control
// stays in lock-step — so a sort added/removed in the contract breaks this test
// until the UI is updated, instead of drifting silently.
// 契约 schema 是权威。运行时读取其字面量成员（TypeBox 联合暴露 `anyOf:[{const}]`），
// 断言共享控件与之同步——契约增删排序档位即令此测试失败，直到 UI 同步，杜绝静默漂移。
const contractSorts = (
  streamSortSchema as { anyOf: ReadonlyArray<{ const: string }> }
).anyOf
  .map((member) => member.const)
  .sort();

describe("stream sort control stays in lock-step with the contract", () => {
  test("options cover exactly the contract StreamSort union", () => {
    const options: string[] = [...STREAM_SORT_OPTIONS];
    expect(options.sort()).toEqual(contractSorts);
  });

  test("every sort has an i18n key and no key is orphaned", () => {
    expect(Object.keys(STREAM_SORT_I18N_KEY).sort()).toEqual(contractSorts);
  });

  test("the contract actually defines the expected sorts (guards the guard)", () => {
    expect(contractSorts).toEqual(["best", "hot", "new", "rising", "top"]);
  });
});

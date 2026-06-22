import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Custom lineHeight tokens from typography.ts must be wired into the UnoCSS
// theme in uno-config.ts. Without this bridge, `leading-ui`, `leading-dense`,
// and `leading-body` generate zero CSS — silently breaking ~500 class usages.
// typography.ts 中的自定义 lineHeight token 必须在 uno-config.ts 的 UnoCSS
// 主题中接入。缺少这个桥接时，leading-ui、leading-dense、leading-body 将不
// 生成 CSS——静默地破坏约 500 个类使用。

const TYPOGRAPHY_PATH = join(
  import.meta.dir,
  "../../package/ui/src/config/tokens/typography.ts",
);
const UNO_CONFIG_PATH = join(
  import.meta.dir,
  "../../package/ui/src/config/uno-config.ts",
);

const REQUIRED_TOKENS = ["ui", "dense", "body", "reader"];

describe("lineHeight token wiring", () => {
  test("all typography lineHeight tokens are defined in uno-config theme", () => {
    const typographySrc = readFileSync(TYPOGRAPHY_PATH, "utf-8");
    const unoConfigSrc = readFileSync(UNO_CONFIG_PATH, "utf-8");

    for (const token of REQUIRED_TOKENS) {
      expect(typographySrc).toContain(`${token}:`);
    }

    expect(unoConfigSrc).toContain("lineHeight:");

    const missing = REQUIRED_TOKENS.filter(
      (t) => !new RegExp(`lineHeight:[\\s\\S]*?${t}:\\s*"[\\d.]+"`, "m").test(unoConfigSrc),
    );
    expect(missing).toEqual([]);
  });
});

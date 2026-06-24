import { describe, expect, test } from "bun:test";
import { scanI18nSourceForTest } from "../src/commands/convention/rules";

function rulesFor(relFilePath: string, source: string) {
  return scanI18nSourceForTest(relFilePath, source).map(
    (violation) => violation.rule,
  );
}

describe("frontend i18n convention checks", () => {
  test("passes typed map translation lookup", () => {
    expect(
      rulesFor(
        "packages/app/src/example.tsx",
        `
          const LABEL_KEYS = {
            save: "common:save",
          } satisfies Record<"save", "common:\${string}">;

          export function Example({ t }) {
            return <button>{t(LABEL_KEYS.save)}</button>;
          }
        `,
      ),
    ).toEqual([]);
  });

  test("rejects dynamic translation keys", () => {
    expect(
      rulesFor(
        "packages/app/src/example.tsx",
        `
          export function Example({ t, keyName }) {
            return <button>{t(keyName)}</button>;
          }
        `,
      ),
    ).toContain("R11");
  });

  test("rejects template-literal translation keys", () => {
    expect(
      rulesFor(
        "packages/app/src/example.tsx",
        `
          export function Example({ t, keyName }) {
            return <button>{t(\`common:\${keyName}\`)}</button>;
          }
        `,
      ),
    ).toContain("R11");
  });

  test("rejects fallback-string translation calls", () => {
    expect(
      rulesFor(
        "packages/app/src/example.tsx",
        `
          export function Example({ t }) {
            return <button>{t("common:save", "Save")}</button>;
          }
        `,
      ),
    ).toContain("R12");
  });

  test("rejects contract i18nKey fields", () => {
    expect(
      rulesFor(
        "packages/contract/src/example.ts",
        `
          export const Example = t.Object({
            i18nKey: t.String(),
          });
        `,
      ),
    ).toContain("R12");
  });
});

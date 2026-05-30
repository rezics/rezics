import { describe, expect, test } from "bun:test";
import { scanI18nSourceForTest } from "../src/commands/convention/rules";

function rulesFor(relFilePath: string, source: string) {
  return scanI18nSourceForTest(relFilePath, source).map(
    (violation) => violation.rule,
  );
}

describe("frontend i18n convention checks", () => {
  test("passes named generated message imports", () => {
    expect(
      rulesFor(
        "package/app/src/example.tsx",
        `
          import { common_save } from "@rezics/i18n/messages";

          export function Example() {
            return <button>{common_save()}</button>;
          }
        `,
      ),
    ).toEqual([]);
  });

  test("rejects generated message namespace imports", () => {
    expect(
      rulesFor(
        "package/app/src/example.tsx",
        `
          import * as m from "@rezics/i18n/messages";

          export function Example() {
            return <button>{m.common_save()}</button>;
          }
        `,
      ),
    ).toContain("R11");
  });

  test("rejects legacy fallback-string translation calls", () => {
    expect(
      rulesFor(
        "package/app/src/example.tsx",
        `
          export function Example({ t }) {
            return <button>{t("common.save", "Save")}</button>;
          }
        `,
      ),
    ).toContain("R12");
  });

  test("rejects static UI copy fallbacks around generated messages", () => {
    expect(
      rulesFor(
        "package/admin/src/example.tsx",
        `
          import * as m from "@rezics/i18n/messages";

          export function Example() {
            return <button>{m.common_save() ?? "Save"}</button>;
          }
        `,
      ),
    ).toContain("R12");
  });

  test("rejects dynamic generated message access", () => {
    expect(
      rulesFor(
        "package/app/src/example.tsx",
        `
          import * as m from "@rezics/i18n/paraglide/messages";

          export function Example({ keyName }) {
            return <span>{m[keyName]()}</span>;
          }
        `,
      ),
    ).toContain("R11");
  });

  test("rejects admin-local locale imports", () => {
    expect(
      rulesFor(
        "package/admin/src/example.tsx",
        `
          import { labels } from "@/locale";

          export function Example() {
            return <span>{labels.save}</span>;
          }
        `,
      ),
    ).toContain("R12");
  });
});

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const appSrc = join(import.meta.dir, "../../package/app/src");

function walk(dir: string): string[] {
  const entries: string[] = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, d.name);
    if (d.isDirectory()) entries.push(...walk(full));
    else if (/\.(tsx?)$/.test(d.name)) entries.push(full);
  }
  return entries;
}

const files = walk(appSrc).filter(
  (f) =>
    !f.includes(".gen.") && !f.includes(".test.") && !f.includes("/shadcn/"),
);

// Mutations whose toast is declared in meta.successToast — these must NOT have
// a per-call-site onSuccess toast re-wiring the same key. The pattern
// `useFooMutation({ onSuccess: () => toast.success(...) })` is fine for
// mutations that aren't in this list or need call-site-specific behaviour.
// 已在 meta.successToast 声明 toast 的 mutation hook，不得在调用侧
// 重复手写 onSuccess toast。不在此列表或有调用侧特殊行为的 mutation
// 不受限制。
const META_TOAST_HOOKS = [
  "useUpdateMemberRoleMutation",
  "useRemoveMemberMutation",
  "useApproveRealmContentMutation",
  "useRemoveRealmContentMutation",
  "useRestoreRealmContentMutation",
  "useDecideRealmCaseMutation",
  "useUpdateRealmMutation",
  "useUpdateZone",
  "useUpdateZoneBoundary",
  "useUpdateZoneNav",
  "useUpdateZoneTheme",
  "useCreateZonePage",
  "useUpdateZonePage",
  "useDeleteZonePage",
  "useUpdateShelfMutation",
  "useDeleteUnitExternalLink",
];

describe("meta.successToast coverage", () => {
  test("tsr.ts Register.mutationMeta declares successToast", () => {
    const tsr = readFileSync(
      join(import.meta.dir, "../../package/api/src/react-query/tsr.ts"),
      "utf-8",
    );
    expect(tsr).toContain("successToast");
    expect(tsr).toContain("onMutationSuccess");
  });

  test("meta.successToast hooks must not have call-site onSuccess toast", () => {
    const hookPattern = new RegExp(
      `(${META_TOAST_HOOKS.join("|")})\\(\\{[^}]*onSuccess.*toast\\.success`,
    );
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (hookPattern.test(src)) {
        const rel = file.replace(appSrc, "app/src");
        throw new Error(
          `${rel} has a per-call-site toast.success on a meta.successToast hook — remove the onSuccess toast`,
        );
      }
    }
  });
});

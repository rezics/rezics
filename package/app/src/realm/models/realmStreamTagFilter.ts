import type { RealmTagTreeNode } from "@rezics/contract";
import {
  realmTagTreeNodeDisplayLabel,
  type RealmTagTreeDisplayNames,
} from "./realmTagTreeHydration";

export type RealmStreamTagChip = {
  tagId: string;
  label: string;
  querySource: "normal" | "policy";
};

export const REALM_STREAM_TAG_SHORTCUT_LIMIT = 12;

export function collectRealmStreamTagChips(
  nodes: RealmTagTreeNode[] | undefined,
  displayNames?: RealmTagTreeDisplayNames,
): RealmStreamTagChip[] {
  const chips: RealmStreamTagChip[] = [];

  const visit = (items: RealmTagTreeNode[]) => {
    for (const item of items) {
      if (item.kind === "tag") {
        chips.push({
          tagId: item.tagUnitId,
          label: realmTagTreeNodeDisplayLabel(item, displayNames),
          querySource: item.querySource ?? "normal",
        });
      }
      if (item.children?.length) visit(item.children);
    }
  };

  visit(nodes ?? []);
  return chips;
}

export function orderRealmStreamTagChips(
  chips: RealmStreamTagChip[],
  selectedTagIds: readonly string[],
  selectedPolicyTagIds: readonly string[] = [],
  shortcutLimit = REALM_STREAM_TAG_SHORTCUT_LIMIT,
) {
  const selected = new Set(selectedTagIds);
  const selectedPolicy = new Set(selectedPolicyTagIds);
  const selectedChips = chips.filter((chip) =>
    chip.querySource === "policy"
      ? selectedPolicy.has(chip.tagId)
      : selected.has(chip.tagId),
  );
  // The cap keeps this row a stream shortcut surface; complete browsing stays in
  // the realm Tags tab, so selected chips are preserved outside the shortcut cap.
  // 该上限使此行保持为信息流快捷入口；完整浏览仍在 realm 的 Tags 标签页中进行，
  // 因此已选中的 chip 不受快捷入口上限的约束而被保留。
  const shortcutChips = chips
    .filter((chip) =>
      chip.querySource === "policy"
        ? !selectedPolicy.has(chip.tagId)
        : !selected.has(chip.tagId),
    )
    .slice(0, shortcutLimit);

  return [...selectedChips, ...shortcutChips];
}

export function toggleRealmStreamTagId(
  selectedTagIds: readonly string[],
  tagId: string,
) {
  return selectedTagIds.includes(tagId)
    ? selectedTagIds.filter((id) => id !== tagId)
    : [...selectedTagIds, tagId];
}

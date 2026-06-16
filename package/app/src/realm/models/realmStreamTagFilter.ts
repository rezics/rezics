import type { TagTreeNode } from "@rezics/contract";

export type RealmStreamTagChip = {
  tagId: string;
  label: string;
};

export const REALM_STREAM_TAG_SHORTCUT_LIMIT = 12;

export function realmTagNodeLabel(node: TagTreeNode, language: string) {
  const translations = node.labelTranslations?.translations;
  const fallbackLanguage = node.labelTranslations?.fallbackLanguage;
  return (
    translations?.[language] ??
    (fallbackLanguage ? translations?.[fallbackLanguage] : undefined) ??
    node.label?.trim() ??
    node.tagId?.slice(0, 8) ??
    "Untitled"
  );
}

export function collectRealmStreamTagChips(
  nodes: TagTreeNode[] | undefined,
  language: string,
): RealmStreamTagChip[] {
  const chips: RealmStreamTagChip[] = [];

  const visit = (items: TagTreeNode[]) => {
    for (const item of items) {
      if (item.tagId) {
        chips.push({
          tagId: item.tagId,
          label: realmTagNodeLabel(item, language),
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
  shortcutLimit = REALM_STREAM_TAG_SHORTCUT_LIMIT,
) {
  const selected = new Set(selectedTagIds);
  const selectedChips = chips.filter((chip) => selected.has(chip.tagId));
  // The cap keeps this row a stream shortcut surface; complete browsing stays in
  // the realm Tags tab, so selected chips are preserved outside the shortcut cap.
  // 该上限使此行保持为信息流快捷入口；完整浏览仍在 realm 的 Tags 标签页中进行，
  // 因此已选中的 chip 不受快捷入口上限的约束而被保留。
  const shortcutChips = chips
    .filter((chip) => !selected.has(chip.tagId))
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

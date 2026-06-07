import type { TagTreeNode } from "@rezics/contract";

export type RealmFeedTagChip = {
  tagId: string;
  label: string;
};

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

export function collectRealmFeedTagChips(
  nodes: TagTreeNode[] | undefined,
  language: string,
): RealmFeedTagChip[] {
  const chips: RealmFeedTagChip[] = [];

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

export function orderRealmFeedTagChips(
  chips: RealmFeedTagChip[],
  selectedTagIds: readonly string[],
) {
  const selected = new Set(selectedTagIds);
  return [
    ...chips.filter((chip) => selected.has(chip.tagId)),
    ...chips.filter((chip) => !selected.has(chip.tagId)),
  ];
}

export function toggleRealmFeedTagId(
  selectedTagIds: readonly string[],
  tagId: string,
) {
  return selectedTagIds.includes(tagId)
    ? selectedTagIds.filter((id) => id !== tagId)
    : [...selectedTagIds, tagId];
}

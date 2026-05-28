import type { TagTreeNode } from "@rezics/contract";
import { useLocale, useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import type React from "react";
import { useMemo } from "react";

export interface RealmFeedTagFilterProps {
  tagTree?: TagTreeNode[];
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
}

type TagChip = {
  tagId: string;
  label: string;
};

function nodeLabel(node: TagTreeNode, language: string) {
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

function collectTags(
  nodes: TagTreeNode[] | undefined,
  language: string,
): TagChip[] {
  const chips: TagChip[] = [];

  const visit = (items: TagTreeNode[]) => {
    for (const item of items) {
      if (item.tagId && !item.disabled) {
        chips.push({
          tagId: item.tagId,
          label: nodeLabel(item, language),
        });
      }
      if (item.children?.length) visit(item.children);
    }
  };

  visit(nodes ?? []);
  return chips;
}

export const RealmFeedTagFilter: React.FC<RealmFeedTagFilterProps> = ({
  tagTree,
  selectedTagIds,
  onChange,
}) => {
  const locale = useLocale();
  const chips = useMemo(() => collectTags(tagTree, locale), [locale, tagTree]);
  const selected = useMemo(() => new Set(selectedTagIds), [selectedTagIds]);

  if (chips.length === 0) return null;

  const toggle = (tagId: string) => {
    onChange(
      selected.has(tagId)
        ? selectedTagIds.filter((id) => id !== tagId)
        : [...selectedTagIds, tagId],
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <Button
          key={chip.tagId}
          type="button"
          size="sm"
          variant={selected.has(chip.tagId) ? "default" : "secondary"}
          onClick={() => toggle(chip.tagId)}
        >
          {chip.label}
        </Button>
      ))}
    </div>
  );
};

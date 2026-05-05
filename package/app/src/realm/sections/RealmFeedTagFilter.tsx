import type { TagTreeNode } from "@rezics/contract";
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

function collectTags(nodes: TagTreeNode[] | undefined): TagChip[] {
  const chips: TagChip[] = [];

  const visit = (items: TagTreeNode[]) => {
    for (const item of items) {
      if (item.tagId && !item.disabled) {
        chips.push({
          tagId: item.tagId,
          label: item.label?.trim() || item.tagId.slice(0, 8),
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
  const chips = useMemo(() => collectTags(tagTree), [tagTree]);
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

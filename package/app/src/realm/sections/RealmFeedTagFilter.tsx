import type { TagTreeNode } from "@rezics/contract";
import { useLocale } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import type React from "react";
import { useMemo } from "react";
import {
  collectRealmFeedTagChips,
  orderRealmFeedTagChips,
  toggleRealmFeedTagId,
} from "../models/realmFeedTagFilter";

export interface RealmFeedTagFilterProps {
  tagTree?: TagTreeNode[];
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
}

export const RealmFeedTagFilter: React.FC<RealmFeedTagFilterProps> = ({
  tagTree,
  selectedTagIds,
  onChange,
}) => {
  const locale = useLocale();
  const chips = useMemo(
    () => collectRealmFeedTagChips(tagTree, locale),
    [locale, tagTree],
  );
  const orderedChips = useMemo(
    () => orderRealmFeedTagChips(chips, selectedTagIds),
    [chips, selectedTagIds],
  );
  const selected = useMemo(() => new Set(selectedTagIds), [selectedTagIds]);

  if (chips.length === 0) return null;

  const toggle = (tagId: string) => {
    onChange(toggleRealmFeedTagId(selectedTagIds, tagId));
  };

  return (
    <div className="flex w-full gap-2 overflow-x-auto pb-1">
      {orderedChips.map((chip) => (
        <Button
          key={chip.tagId}
          type="button"
          size="sm"
          variant={selected.has(chip.tagId) ? "default" : "secondary"}
          className="shrink-0"
          aria-pressed={selected.has(chip.tagId)}
          onClick={() => toggle(chip.tagId)}
        >
          {chip.label}
        </Button>
      ))}
      {/* Keep All last so selected tags stay first for fast filter cancellation. */}
      <Button
        type="button"
        size="sm"
        variant={selectedTagIds.length === 0 ? "default" : "secondary"}
        className="shrink-0"
        onClick={() => onChange([])}
      >
        All
      </Button>
    </div>
  );
};

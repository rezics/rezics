import { getSeedTagId } from "@rezics/api/infra/bootstrap";
import {
  SEED_TAG_NAMES,
  SEED_TAG_TITLES,
  type SeedTagName,
} from "@rezics/contract";
import { shelf_content_type_tags_legend } from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { Badge } from "@rezics/ui/shadcn";
import { useMemo } from "react";

const i18nMessages = {
  shelf_content_type_tags_legend,
};

export interface SeedTagChipGroupProps {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

export function SeedTagChipGroup({
  value,
  onChange,
  disabled = false,
}: SeedTagChipGroupProps) {
  const m = useMessage(i18nMessages);
  const chips = useMemo(
    () =>
      SEED_TAG_NAMES.map((name) => {
        const tagId = getSeedTagId(name);
        return tagId ? { name, tagId, label: SEED_TAG_TITLES[name] } : null;
      }).filter(
        (c): c is { name: SeedTagName; tagId: string; label: string } =>
          c !== null,
      ),
    [],
  );

  const selected = useMemo(() => new Set(value), [value]);

  const toggle = (tagId: string) => {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    onChange([...next]);
  };

  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">{m.shelf_content_type_tags_legend()}</legend>
      {chips.map(({ name, tagId, label }) => {
        const isSelected = selected.has(tagId);
        return (
          <Badge
            key={name}
            variant={isSelected ? "default" : "outline"}
            className={
              disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            }
            aria-pressed={isSelected}
            aria-disabled={disabled || undefined}
            onClick={() => toggle(tagId)}
          >
            {label}
          </Badge>
        );
      })}
    </fieldset>
  );
}

export default SeedTagChipGroup;

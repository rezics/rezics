import { getSeedTagId } from "@rezics/api/infra/bootstrap";
import {
  SEED_TAG_NAMES,
  SEED_TAG_TITLES,
  type SeedTagName,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Badge } from "@rezics/ui/shadcn";
import { useMemo } from "react";

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
  const { t } = useTranslation(["entity"]);
  // Map seed tag names to i18n keys for content type labels.
  // 将 seed tag 名称映射到 i18n 键用于内容类型标签。
  const seedTagI18nKeys: Record<SeedTagName, string> = {
    book: "entity:seed_tag_book",
    game: "entity:seed_tag_game",
    media: "entity:seed_tag_media",
    post: "entity:seed_tag_post",
    link: "entity:seed_tag_link",
  };

  const chips = useMemo(
    () =>
      SEED_TAG_NAMES.map((name) => {
        const tagId = getSeedTagId(name);
        // Use i18n key if available, fallback to SEED_TAG_TITLES.
        // 如果可用，使用 i18n 键，否则使用 SEED_TAG_TITLES 作为后备。
        const label = t(seedTagI18nKeys[name]) || SEED_TAG_TITLES[name];
        return tagId ? { name, tagId, label } : null;
      }).filter(
        (c): c is { name: SeedTagName; tagId: string; label: string } =>
          c !== null,
      ),
    [t],
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
      <legend className="sr-only">
        {t("entity:shelf_content_type_tags_legend")}
      </legend>
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

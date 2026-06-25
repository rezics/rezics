import type {
  CreateTagInput,
  UnitTagDTO,
  UpdateTagInput,
} from "@rezics/contract/api/tag/tag.types";
import {
  useCreateTagMutation,
  useUpdateTagMutation,
} from "@rezics/contract/api/tag/tag.mutations";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Button, Input, Label, Textarea } from "@rezics/ui/shadcn";
import type React from "react";
import { useState } from "react";

/**
 * TagEdit - now creates/updates tags using the new translation-based model.
 * Tags are Units with type=TAG. CreateTagInput requires translations[].
 */
export type TagEditProps = {
  tag?: UnitTagDTO | null;
  initialName?: string;
  onSaved?: (tag: UnitTagDTO) => void;
  className?: string;
};

export const TagEdit: React.FC<TagEditProps> = ({
  tag,
  initialName,
  onSaved,
  className,
}) => {
  const { t } = useTranslation(["common", "community"]);
  const isUpdate = !!tag;
  const [name, setName] = useState(initialName ?? tag?.label ?? "");
  const [color, setColor] = useState(tag?.visual?.color ?? "");
  const [avatarUrl, setAvatarUrl] = useState(tag?.visual?.avatarUrl ?? "");
  const [iconSvg, setIconSvg] = useState(tag?.visual?.iconSvg ?? "");

  const createMutation = useCreateTagMutation({
    onSuccess: (data) => onSaved?.(data as UnitTagDTO),
  });
  const updateMutation = useUpdateTagMutation({
    onSuccess: (data) => onSaved?.(data as UnitTagDTO),
  });

  const busy = createMutation.isPending || updateMutation.isPending;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const translations = [{ language: DEFAULT_LANGUAGE, title: trimmed }];
    const visual = {
      color: color.trim() || null,
      avatarUrl: avatarUrl.trim() || null,
      iconSvg: iconSvg.trim() || null,
    };
    if (isUpdate && tag) {
      const payload: UpdateTagInput = { translations, visual };
      await updateMutation.mutateAsync({
        unitId: tag.unitId,
        input: payload,
      });
    } else {
      const payload: CreateTagInput = { translations, visual };
      await createMutation.mutateAsync(payload);
    }
  };

  return (
    <form onSubmit={onSubmit} className={className}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="tag-name" className="text-sm text-text-secondary">
            {t("common:name")}
          </Label>
          <Input
            id="tag-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="tag-color" className="text-sm text-text-secondary">
              {t("community:tag_visual_color")}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="tag-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder={t("community:tag_visual_color_placeholder")}
                className="min-w-0"
              />
              <input
                type="color"
                value={/^#[0-9a-f]{6}$/i.test(color) ? color : "#db515c"}
                onChange={(e) => setColor(e.target.value)}
                aria-label={t("community:tag_visual_color")}
                className="h-9 w-10 shrink-0 rounded-sm border border-border-whisper bg-transparent"
              />
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Label
              htmlFor="tag-avatar-url"
              className="text-sm text-text-secondary"
            >
              {t("community:tag_visual_avatar_url")}
            </Label>
            <Input
              id="tag-avatar-url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder={t("community:tag_visual_avatar_placeholder")}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="tag-icon-svg" className="text-sm text-text-secondary">
            {t("community:tag_visual_svg_icon")}
          </Label>
          <Textarea
            id="tag-icon-svg"
            value={iconSvg}
            onChange={(e) => setIconSvg(e.target.value)}
            placeholder={t("community:tag_visual_svg_placeholder")}
            className="min-h-28 font-mono text-xs"
          />
          <p className="m-0 text-xs leading-dense text-text-tertiary">
            {t("community:tag_visual_svg_note")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={busy}>
            {isUpdate ? t("common:save_changes") : t("community:tag_create")}
          </Button>
          {busy && <Spinner size="sm" />}
        </div>
      </div>
    </form>
  );
};

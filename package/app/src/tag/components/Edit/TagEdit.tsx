import type {
  CreateTagInput,
  UnitTagDTO,
  UpdateTagInput,
} from "@rezics/api/tag/tag";
import {
  useCreateTagMutation,
  useUpdateTagMutation,
} from "@rezics/api/tag/tag";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import {
  common_name,
  common_save_changes,
  tag_create,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Button, Input, Label } from "@rezics/ui/shadcn";
import type React from "react";
import { useState } from "react";

const i18nMessages = {
  common_name,
  common_save_changes,
  tag_create,
};

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
  const m = useMessage(i18nMessages);
  const isUpdate = !!tag;
  const [name, setName] = useState(initialName ?? "");

  const createMutation = useCreateTagMutation({
    onSuccess: (data) => onSaved?.(data as UnitTagDTO),
  });
  const updateMutation = useUpdateTagMutation({
    onSuccess: (data) => onSaved?.(data as UnitTagDTO),
  });

  const busy = createMutation.isPending || updateMutation.isPending;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const translations = [{ language: DEFAULT_LANGUAGE, title: name.trim() }];
    if (isUpdate && tag) {
      const payload: UpdateTagInput = { translations };
      await updateMutation.mutateAsync({
        unitId: tag.tagUnitId,
        input: payload,
      });
    } else {
      const payload: CreateTagInput = { translations };
      await createMutation.mutateAsync(payload);
    }
  };

  return (
    <form onSubmit={onSubmit} className={className}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="tag-name" className="text-sm text-text-secondary">
            {m.common_name()}
          </Label>
          <Input
            id="tag-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={busy}>
            {isUpdate ? m.common_save_changes() : m.tag_create()}
          </Button>
          {busy && <Spinner size="sm" />}
        </div>
      </div>
    </form>
  );
};

export default TagEdit;

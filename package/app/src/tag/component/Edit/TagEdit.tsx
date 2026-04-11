import {
  Button,
  CircularProgress,
  TextField,
} from "@mui/material";
import type {
  CreateTagInput,
  UnitTagDTO,
  UpdateTagInput,
} from "@rezics/api/tag/tag";
import {
  useCreateTagMutation,
  useUpdateTagMutation,
} from "@rezics/api/tag/tag";
import type React from "react";
import { useState } from "react";

/**
 * TagEdit - now creates/updates tags using the new translation-based model.
 * Tags are Units with type=TAG. CreateTagInput requires translations[].
 */
export type TagEditProps = {
  tag?: UnitTagDTO | null;
  onSaved?: (tag: UnitTagDTO) => void;
  className?: string;
};

export const TagEdit: React.FC<TagEditProps> = ({
  tag,
  onSaved,
  className,
}) => {
  const isUpdate = !!tag;
  const [name, setName] = useState(tag?.tagLabel ?? "");

  const createMutation = useCreateTagMutation({
    onSuccess: (data) => onSaved?.(data as UnitTagDTO),
  });
  const updateMutation = useUpdateTagMutation({
    onSuccess: (data) => onSaved?.(data as UnitTagDTO),
  });

  const busy = createMutation.isPending || updateMutation.isPending;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const translations = [{ language: 'zh-CN', title: name.trim() }];
    if (isUpdate && tag) {
      const payload: UpdateTagInput = { translations };
      await updateMutation.mutateAsync({ unitId: tag.tagUnitId, input: payload });
    } else {
      const payload: CreateTagInput = { translations };
      await createMutation.mutateAsync(payload);
    }
  };

  return (
    <form onSubmit={onSubmit} className={className}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="tag-name" className="text-sm text-gray-600">
            名称
          </label>
          <TextField
            id="tag-name"
            size="small"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            variant="contained"
            size="small"
            disabled={busy}
          >
            {isUpdate ? "保存修改" : "创建标签"}
          </Button>
          {busy && <CircularProgress size={18} />}
        </div>
      </div>
    </form>
  );
};

export default TagEdit;

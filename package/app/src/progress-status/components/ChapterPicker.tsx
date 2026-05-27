import {
  progress_status_chapter_picker_none,
  progress_status_chapter_picker_placeholder,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { useChapterPicker } from "../hooks/useChapterPicker";

const i18nMessages = {
  progress_status_chapter_picker_none,
  progress_status_chapter_picker_placeholder,
};

type ChapterPickerProps = {
  bookUnitId: string;
  value?: string;
  onChange: (contentUnitId: string | undefined) => void;
  disabled?: boolean;
};

const NONE_VALUE = "__none";

export function ChapterPicker({
  bookUnitId,
  value,
  onChange,
  disabled,
}: ChapterPickerProps) {
  const m = useMessage(i18nMessages);
  const { options, isLoading } = useChapterPicker(bookUnitId);

  return (
    <Select
      value={value ?? NONE_VALUE}
      onValueChange={(next: string | null | undefined) => {
        if (next == null) return;
        onChange(next === NONE_VALUE ? undefined : next);
      }}
      disabled={disabled || isLoading || options.length === 0}
    >
      <SelectTrigger>
        <SelectValue
          placeholder={m.progress_status_chapter_picker_placeholder()}
        />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>
          {m.progress_status_chapter_picker_none()}
        </SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.contentUnitId} value={opt.contentUnitId}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

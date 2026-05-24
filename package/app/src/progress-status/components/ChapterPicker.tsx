import * as m from "@rezics/i18n/messages";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { useChapterPicker } from "../hooks/useChapterPicker";

type ChapterPickerProps = {
  bookUnitId: string;
  value?: string;
  onChange: (chapterUnitId: string | undefined) => void;
  disabled?: boolean;
};

const NONE_VALUE = "__none";

export function ChapterPicker({
  bookUnitId,
  value,
  onChange,
  disabled,
}: ChapterPickerProps) {
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
          <SelectItem key={opt.chapterUnitId} value={opt.chapterUnitId}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

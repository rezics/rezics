import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
          placeholder={t(
            "progress_status.chapter_picker.placeholder",
            "選擇章節",
          )}
        />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>
          {t("progress_status.chapter_picker.none", "未指定")}
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

import { useTranslation } from "@rezics/i18n/react";
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
  onChange: (nodeId: string | undefined) => void;
  disabled?: boolean;
};

const NONE_VALUE = "__none";

export function ChapterPicker({
  bookUnitId,
  value,
  onChange,
  disabled,
}: ChapterPickerProps) {
  const { t } = useTranslation(["community"]);
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
            "community:progress_status_chapter_picker_placeholder",
          )}
        />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>
          {t("community:progress_status_chapter_picker_none")}
        </SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.nodeId} value={opt.nodeId}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

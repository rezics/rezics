import { useTranslation } from "@rezics/i18n/react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import type React from "react";

export type RealmStreamSort = "best" | "hot" | "new" | "top" | "rising";

const SORT_KEYS: readonly RealmStreamSort[] = [
  "best",
  "hot",
  "new",
  "top",
  "rising",
] as const;

const SORT_I18N_KEY: Record<RealmStreamSort, string> = {
  best: "stream_sort_best",
  hot: "stream_sort_hot",
  new: "stream_sort_new",
  top: "stream_sort_top",
  rising: "stream_sort_rising",
};

export interface RealmStreamSortSwitcherProps {
  value: RealmStreamSort;
  onChange: (value: RealmStreamSort) => void;
}

export const RealmStreamSortSwitcher: React.FC<
  RealmStreamSortSwitcherProps
> = ({ value, onChange }) => {
  const { t } = useTranslation("entity");
  return (
    <div className="flex w-full">
      <Select
        value={value}
        onValueChange={(next) => onChange(next as RealmStreamSort)}
      >
        <SelectTrigger
          className="w-full sm:w-52"
          aria-label={t("stream_sort_label")}
        >
          <SelectValue>{t(SORT_I18N_KEY[value])}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>{t("stream_sort_label")}</SelectLabel>
            {SORT_KEYS.map((key) => (
              <SelectItem key={key} value={key}>
                {t(SORT_I18N_KEY[key])}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};

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

export type RealmFeedSort = "best" | "hot" | "new" | "top" | "rising";

const SORT_KEYS: readonly RealmFeedSort[] = [
  "best",
  "hot",
  "new",
  "top",
  "rising",
] as const;

const SORT_I18N_KEY: Record<RealmFeedSort, string> = {
  best: "realm_feed_sort_best",
  hot: "realm_feed_sort_hot",
  new: "realm_feed_sort_new",
  top: "realm_feed_sort_top",
  rising: "realm_feed_sort_rising",
};

export interface RealmFeedSortSwitcherProps {
  value: RealmFeedSort;
  onChange: (value: RealmFeedSort) => void;
}

export const RealmFeedSortSwitcher: React.FC<RealmFeedSortSwitcherProps> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation("entity");
  return (
    <div className="flex w-full">
      <Select
        value={value}
        onValueChange={(next) => onChange(next as RealmFeedSort)}
      >
        <SelectTrigger
          className="w-full sm:w-52"
          aria-label={t("realm_feed_sort_label")}
        >
          <SelectValue>{t(SORT_I18N_KEY[value])}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>{t("realm_feed_sort_label")}</SelectLabel>
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

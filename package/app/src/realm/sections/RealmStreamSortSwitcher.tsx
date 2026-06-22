import type { StreamSort } from "@rezics/contract";
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
import { STREAM_SORT_I18N_KEY, STREAM_SORT_OPTIONS } from "@/stream";

/** Realm-facing name for the stream sort, anchored to the contract `StreamSort`. */
/** realm 侧的流排序类型名，锚定契约 `StreamSort`。 */
export type RealmStreamSort = StreamSort;

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
          <SelectValue>{t(STREAM_SORT_I18N_KEY[value])}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>{t("stream_sort_label")}</SelectLabel>
            {STREAM_SORT_OPTIONS.map((key) => (
              <SelectItem key={key} value={key}>
                {t(STREAM_SORT_I18N_KEY[key])}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};

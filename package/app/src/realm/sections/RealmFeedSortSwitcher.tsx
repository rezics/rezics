import { Button } from "@rezics/ui/shadcn";
import type React from "react";

export type RealmFeedSort = "new" | "top" | "hot";

export interface RealmFeedSortSwitcherProps {
  value: RealmFeedSort;
  onChange: (value: RealmFeedSort) => void;
}

const OPTIONS = {
  new: i18nMessages.realm_feed_sort_new,
  top: i18nMessages.realm_feed_sort_top,
  hot: i18nMessages.realm_feed_sort_hot,
} as const satisfies Record<RealmFeedSort, () => string>;

export const RealmFeedSortSwitcher: React.FC<RealmFeedSortSwitcherProps> = ({
  value,
  onChange,
}) => {
  return (
    <div className="flex items-center gap-1">
      {Object.entries(OPTIONS).map(([optionValue, label]) => (
        <Button
          key={optionValue}
          type="button"
          size="sm"
          variant={value === optionValue ? "default" : "ghost"}
          onClick={() => onChange(optionValue as RealmFeedSort)}
        >
          {label()}
        </Button>
      ))}
    </div>
  );
};

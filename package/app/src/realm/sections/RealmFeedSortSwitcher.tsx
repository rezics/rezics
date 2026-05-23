import * as m from "@rezics/i18n/messages";
import { Button } from "@rezics/ui/shadcn";
import type React from "react";

export type RealmFeedSort = "new" | "top" | "hot";

export interface RealmFeedSortSwitcherProps {
  value: RealmFeedSort;
  onChange: (value: RealmFeedSort) => void;
}

const OPTIONS = {
  new: m.realm_feed_sort_new,
  top: m.realm_feed_sort_top,
  hot: m.realm_feed_sort_hot,
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

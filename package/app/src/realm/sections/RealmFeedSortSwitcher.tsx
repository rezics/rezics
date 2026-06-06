import { getI18nRuntime } from "@rezics/i18n/runtime";

const i18nMessages = {
  realm_feed_sort_best: () =>
    getI18nRuntime().i18n.t("entity:realm_feed_sort_best"),
  realm_feed_sort_new: () =>
    getI18nRuntime().i18n.t("entity:realm_feed_sort_new"),
  realm_feed_sort_top: () =>
    getI18nRuntime().i18n.t("entity:realm_feed_sort_top"),
  realm_feed_sort_hot: () =>
    getI18nRuntime().i18n.t("entity:realm_feed_sort_hot"),
  realm_feed_sort_rising: () =>
    getI18nRuntime().i18n.t("entity:realm_feed_sort_rising"),
} as const;

import { Button } from "@rezics/ui/shadcn";
import type React from "react";

export type RealmFeedSort = "best" | "hot" | "new" | "top" | "rising";

export interface RealmFeedSortSwitcherProps {
  value: RealmFeedSort;
  onChange: (value: RealmFeedSort) => void;
}

const OPTIONS = {
  best: i18nMessages.realm_feed_sort_best,
  hot: i18nMessages.realm_feed_sort_hot,
  new: i18nMessages.realm_feed_sort_new,
  top: i18nMessages.realm_feed_sort_top,
  rising: i18nMessages.realm_feed_sort_rising,
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

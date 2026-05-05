import { Button } from "@rezics/ui/shadcn";
import type React from "react";

export type RealmFeedSort = "new" | "top" | "hot";

export interface RealmFeedSortSwitcherProps {
  value: RealmFeedSort;
  onChange: (value: RealmFeedSort) => void;
}

const OPTIONS: { value: RealmFeedSort; label: string }[] = [
  { value: "new", label: "New" },
  { value: "top", label: "Top" },
  { value: "hot", label: "Hot" },
];

export const RealmFeedSortSwitcher: React.FC<RealmFeedSortSwitcherProps> = ({
  value,
  onChange,
}) => {
  return (
    <div className="flex items-center gap-1">
      {OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? "default" : "ghost"}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
};

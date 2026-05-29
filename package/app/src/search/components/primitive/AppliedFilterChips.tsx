import type { SearchQuery } from "@rezics/contract";
import { Badge, Button } from "@rezics/ui/shadcn";
import { X as CloseIcon } from "lucide-react";
import type React from "react";

import { getI18nRuntime } from "@rezics/i18n/runtime";
import {
  buildAppliedFilterChips,
  buildChips,
  type ChipDescriptor as AppliedFilterChipDescriptor,
} from "./chipDescriptors";

export { buildAppliedFilterChips };
export type { AppliedFilterChipDescriptor };

export type AppliedFilterChipsProps = {
  query: SearchQuery;
  hide?: SearchQuery;
  rendered?: (keyof SearchQuery)[];
  onRemove?: (patch: Partial<SearchQuery>) => void;
};

export const AppliedFilterChips: React.FC<AppliedFilterChipsProps> = ({
  query,
  hide = {},
  rendered = [],
  onRemove,
}) => {
  const chips = buildChips(query, hide, new Set(rendered));
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-row flex-wrap gap-2">
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="outline"
          className="flex items-center gap-1"
        >
          <span>{chip.label}</span>
          {onRemove && chip.remove && (
            <Button
              size="icon"
              variant="ghost"
              className="h-4 w-4 p-0"
              aria-label={getI18nRuntime().i18n.t("common:remove")}
              onClick={() => onRemove(chip.remove as Partial<SearchQuery>)}
            >
              <CloseIcon size={12} />
            </Button>
          )}
        </Badge>
      ))}
    </div>
  );
};

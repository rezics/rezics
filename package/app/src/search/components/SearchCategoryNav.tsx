import type { SearchCategory, SearchScope } from "@rezics/contract";
import { Tabs, TabsList, TabsTrigger } from "@rezics/ui/shadcn";
import type React from "react";
import {
  CATEGORY_LABELS,
  permittedCategoriesForScope,
} from "./permittedCategories";

export type SearchCategoryNavProps = {
  scope: SearchScope;
  value: SearchCategory;
  counts?: Partial<Record<SearchCategory, number>>;
  onChange: (next: SearchCategory) => void;
};

export const SearchCategoryNav: React.FC<SearchCategoryNavProps> = ({
  scope,
  value,
  counts,
  onChange,
}) => {
  const permitted = permittedCategoriesForScope(scope);

  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v as SearchCategory)}
      className="min-w-0 max-w-full"
    >
      <TabsList className="w-full max-w-full justify-start overflow-x-auto overscroll-x-contain scroll-smooth">
        {permitted.map((category) => {
          const count = counts?.[category];
          return (
            <TabsTrigger key={category} value={category} className="flex-none">
              <span>{CATEGORY_LABELS[category]()}</span>
              {typeof count === "number" && (
                <span className="ml-1 text-xs text-text-secondary">
                  {count}
                </span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
};

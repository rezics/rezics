import { useTranslation } from "@rezics/i18n/react";
import type {
  ShelfSortField,
  ShelfSortOrder,
  ShelfSortState,
  ShelfView,
} from "@rezics/contract/api/shelf/shelf.types";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";

type ShelfSortPickerValue = `${ShelfSortField}:${ShelfSortOrder}`;

export interface ShelfSortChoice {
  field: ShelfSortField;
  order: ShelfSortOrder;
  label: () => string;
}

export interface ShelfViewChoice<TView extends ShelfView = ShelfView> {
  value: TView;
  label: () => string;
}

interface ShelfSortViewPickerProps<TView extends ShelfView = ShelfView> {
  sort: ShelfSortState;
  sortOptions: readonly ShelfSortChoice[];
  view: TView;
  viewOptions: readonly ShelfViewChoice<TView>[];
  onSortChange: (sort: ShelfSortState) => void;
  onViewChange: (view: TView) => void;
  sortHeading?: string;
  viewHeading?: string;
  className?: string;
}

function sortPickerValue(sort: ShelfSortState): ShelfSortPickerValue {
  return `${sort.field}:${sort.order}`;
}

function parseSortPickerValue(value: string | null): ShelfSortState {
  if (value === null) {
    throw new Error("Shelf sort picker emitted null");
  }

  const [field, order] = value.split(":");
  if (
    (field === "manual" || field === "addedAt" || field === "title") &&
    (order === "asc" || order === "desc")
  ) {
    return { field, order };
  }

  throw new Error(`Unknown shelf sort picker value: ${value}`);
}

export function ShelfSortViewPicker<TView extends ShelfView = ShelfView>({
  sort,
  sortOptions,
  view,
  viewOptions,
  onSortChange,
  onViewChange,
  sortHeading,
  viewHeading,
  className,
}: ShelfSortViewPickerProps<TView>) {
  const { t } = useTranslation("common");
  const effectiveSortHeading = sortHeading ?? t("sort_method");
  const effectiveViewHeading = viewHeading ?? t("view");
  const selectedSortLabel =
    sortOptions
      .find(
        (option) => option.field === sort.field && option.order === sort.order,
      )
      ?.label() ?? sortOptions[0]?.label();
  const selectedViewLabel =
    viewOptions.find((option) => option.value === view)?.label() ??
    viewOptions[0]?.label();

  return (
    <div className={className ?? "flex flex-wrap items-center gap-2"}>
      <Select
        value={sortPickerValue(sort)}
        onValueChange={(value) => onSortChange(parseSortPickerValue(value))}
      >
        <SelectTrigger
          size="sm"
          aria-label={effectiveSortHeading}
          className="border-0 bg-surface-subtle shadow-none hover:bg-surface-elevated"
        >
          <SelectValue>{selectedSortLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end" alignItemWithTrigger={false}>
          <SelectGroup>
            <SelectLabel>{effectiveSortHeading}</SelectLabel>
            {sortOptions.map((option) => (
              <SelectItem
                key={`${option.field}:${option.order}`}
                value={`${option.field}:${option.order}`}
              >
                {option.label()}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select
        value={view}
        onValueChange={(value) => {
          if (value && viewOptions.some((option) => option.value === value)) {
            onViewChange(value as TView);
          }
        }}
      >
        <SelectTrigger
          size="sm"
          aria-label={effectiveViewHeading}
          className="border-0 bg-surface-subtle shadow-none hover:bg-surface-elevated"
        >
          <SelectValue>{selectedViewLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end" alignItemWithTrigger={false}>
          <SelectGroup>
            <SelectLabel>{effectiveViewHeading}</SelectLabel>
            {viewOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label()}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

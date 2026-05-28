import { common_failed_to_load, common_search } from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Separator,
} from "@rezics/ui/shadcn";
import { Search as SearchIcon } from "lucide-react";
import React from "react";
import {
  type PaginatedColumn,
  PaginatedTable,
} from "@/components/table/PaginatedTable";

const i18nMessages = {
  common_failed_to_load,
  common_search,
};

export function SearchablePaginatedTableCard<T>({
  title,
  description,
  errorLabel,
  searchLabel = i18nMessages.common_search(),
  searchPlaceholder,
  searchInputId,
  q,
  onQChange,
  onSearch,
  filters,
  toolbarRight,
  isLoading,
  isError,
  error,
  columns,
  rows,
  getRowId,
  count,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
}: {
  title?: string;
  description?: string;
  errorLabel?: string;
  searchLabel?: string;
  searchPlaceholder?: string;
  searchInputId?: string;
  q: string;
  onQChange: (next: string) => void;
  onSearch: () => void;
  filters?: React.ReactNode;
  toolbarRight?: React.ReactNode;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  columns: PaginatedColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  count: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (nextPage: number) => void;
  onRowsPerPageChange: (nextRowsPerPage: number) => void;
}) {
  const m = useMessage(i18nMessages);
  const fallbackSearchId = React.useId();
  const inputId = searchInputId ?? fallbackSearchId;

  return (
    <>
      {title ? (
        <h2 className="mb-2 text-base font-semibold leading-[1.4]">{title}</h2>
      ) : null}
      {description ? (
        <p className="mb-4 text-sm leading-[1.4] text-text-secondary">
          {description}
        </p>
      ) : null}

      <Card surface="contained" size="sm">
        <CardContent className="p-4">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-1">
              <Label htmlFor={inputId} className="text-xs leading-[1.3]">
                {searchLabel}
              </Label>
              <Input
                id={inputId}
                placeholder={searchPlaceholder}
                value={q}
                onChange={(e) => onQChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSearch();
                }}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={m.common_search()}
              onClick={onSearch}
              className="self-end sm:self-center"
            >
              <SearchIcon className="size-4" />
            </Button>
            {toolbarRight ? (
              <div className="flex shrink-0 items-end gap-2 sm:items-center">
                {toolbarRight}
              </div>
            ) : null}
          </div>

          {filters ? <div className="mt-3">{filters}</div> : null}

          <Separator className="my-4" />

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : isError ? (
            <div>
              <p className="text-sm text-error-text">
                {errorLabel ?? m.common_failed_to_load()}
              </p>
              {error ? (
                <p className="text-xs text-error-text">{String(error)}</p>
              ) : null}
            </div>
          ) : (
            <PaginatedTable<T>
              columns={columns}
              rows={rows}
              getRowId={getRowId}
              count={count}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={onPageChange}
              onRowsPerPageChange={onRowsPerPageChange}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}

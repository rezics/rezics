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
import type React from "react";

import {
  type PaginatedColumn,
  PaginatedTable,
} from "@/components/table/PaginatedTable";

export function SearchablePaginatedTableCard<T>({
  title,
  description,
  searchLabel = "Search",
  searchPlaceholder,
  q,
  onQChange,
  onSearch,
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
  searchLabel?: string;
  searchPlaceholder?: string;
  q: string;
  onQChange: (next: string) => void;
  onSearch: () => void;
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
  return (
    <>
      {title ? (
        <h2 className="text-xl font-extrabold mb-2">{title}</h2>
      ) : null}
      {description ? (
        <p className="text-sm text-text-secondary mb-4">{description}</p>
      ) : null}

      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch">
            <div className="flex-1 flex flex-col gap-1">
              <Label htmlFor="search-input" className="text-xs">
                {searchLabel}
              </Label>
              <Input
                id="search-input"
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
              aria-label="search"
              onClick={onSearch}
              className="self-end sm:self-center"
            >
              <SearchIcon className="size-4" />
            </Button>
            {toolbarRight}
          </div>

          <Separator className="my-4" />

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : isError ? (
            <div>
              <p className="text-sm text-error-text">
                Failed to load.
              </p>
              {error ? (
                <p className="text-xs text-error-text">
                  {String(error)}
                </p>
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

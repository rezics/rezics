import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@rezics/ui/shadcn";
import clsx from "clsx";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import React from "react";

export type PaginatedColumn<T> = {
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  minWidth?: number;
  align?: "left" | "right" | "center";
};

export function PaginatedTable<T>({
  columns,
  rows,
  getRowId,
  count,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  dense = true,
  stickyHeader = true,
  enablePageJump = true,
  className,
}: {
  columns: PaginatedColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  count: number;
  page: number; // 0-based
  rowsPerPage: number;
  onPageChange: (nextPage: number) => void;
  onRowsPerPageChange: (nextRowsPerPage: number) => void;
  dense?: boolean;
  stickyHeader?: boolean;
  enablePageJump?: boolean;
  className?: string;
}) {
  const totalPages = rowsPerPage > 0 ? Math.ceil(count / rowsPerPage) : 0;
  const [pageInput, setPageInput] = React.useState(() => String(page + 1));

  React.useEffect(() => {
    setPageInput(String(page + 1));
  }, [page]);

  const commitPageInput = React.useCallback(() => {
    if (!totalPages) return;

    if (!pageInput) {
      setPageInput(String(page + 1));
      return;
    }

    const parsed = Number(pageInput);
    if (!Number.isFinite(parsed)) {
      setPageInput(String(page + 1));
      return;
    }

    const clamped = Math.min(Math.max(Math.trunc(parsed), 1), totalPages);
    setPageInput(String(clamped));

    const nextPage = clamped - 1;
    if (nextPage !== page) onPageChange(nextPage);
  }, [onPageChange, page, pageInput, totalPages]);

  const fromRow = count === 0 ? 0 : page * rowsPerPage + 1;
  const toRow = Math.min((page + 1) * rowsPerPage, count);

  const cellPaddingClass = dense ? "py-1.5" : "py-[var(--padding-table-row-y)]";
  const textSizeClass = dense ? "text-sm" : "text-base";

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <Table className={textSizeClass}>
          <TableHeader
            className={clsx(
              stickyHeader && "sticky top-0 z-10 bg-surface-canvas",
            )}
          >
            <TableRow>
              {columns.map((c) => (
                <TableHead
                  key={c.id}
                  style={c.minWidth ? { minWidth: c.minWidth } : undefined}
                  className={clsx(
                    cellPaddingClass,
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                  )}
                >
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={getRowId(row)}>
                {columns.map((c) => (
                  <TableCell
                    key={c.id}
                    className={clsx(
                      cellPaddingClass,
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                    )}
                  >
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2 mt-2 px-2 py-1">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <span>Rows per page:</span>
          <Select
            value={String(rowsPerPage)}
            onValueChange={(v) => onRowsPerPageChange(Number(v))}
          >
            <SelectTrigger size="sm" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>
            {fromRow}-{toRow} of {count}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="First page"
            disabled={page <= 0 || !totalPages}
            onClick={() => onPageChange(0)}
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous page"
            disabled={page <= 0 || !totalPages}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next page"
            disabled={!totalPages || page + 1 >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Last page"
            disabled={!totalPages || page + 1 >= totalPages}
            onClick={() => onPageChange(Math.max(totalPages - 1, 0))}
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>

        {enablePageJump ? (
          <div className="flex flex-row gap-2 items-center px-2 py-1">
            <span className="text-sm text-text-secondary">Go to page</span>
            <Input
              value={pageInput}
              onChange={(e) => {
                const next = e.target.value.replace(/[^\d]/g, "");
                setPageInput(next);
              }}
              onBlur={commitPageInput}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitPageInput();
              }}
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label="go to page"
              className="w-24 h-8 text-sm"
              disabled={!totalPages}
            />
            <span className="text-sm text-text-secondary">
              / {Math.max(totalPages, 1)}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={commitPageInput}
              disabled={!totalPages}
            >
              Go
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

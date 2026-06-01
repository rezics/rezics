import type {
  LibraryKind,
  ProgressLibraryRow,
  UnitType,
} from "@rezics/contract";
import { BookOpen, Layers2 } from "lucide-react";
import type React from "react";
import { AppSafeLink, Link } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";

interface ProgressLibraryGridProps {
  rows: readonly ProgressLibraryRow[];
  emptyState?: React.ReactNode;
}

function libraryKindFromUnitType(unitType: UnitType): LibraryKind | null {
  if (unitType === "BOOK") return "book";
  if (unitType === "GAME") return "game";
  if (unitType === "MEDIA") return "media";
  return null;
}

function progressRowHref(row: ProgressLibraryRow): string {
  const kind = libraryKindFromUnitType(row.progressUnit.unitType);
  if (row.resumeRoute?.kind === "node") {
    return `/book/${row.resumeRoute.bookId}/node/${row.resumeRoute.nodeId}`;
  }
  if (kind === "book") return `/book/${row.progressUnit.unitId}`;
  return `/unit/${row.progressUnit.unitId}`;
}

function formatProgress(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function ProgressLibraryCard({ row }: { row: ProgressLibraryRow }) {
  const kind = libraryKindFromUnitType(row.progressUnit.unitType);
  if (!kind) return null;

  const unit = row.progressUnit;
  const context = row.mainUnitContext;
  const href = progressRowHref(row);

  return (
    <article className="min-w-0">
      <Link
        to={href}
        aria-label={unit.title || unit.unitId}
        className="group block min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-surface-subtle text-text-tertiary">
          {unit.coverUrl ? (
            <img
              src={unit.coverUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <BookOpen className="h-8 w-8" aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="mt-2 min-w-0">
          <h3 className="line-clamp-2 text-sm font-medium leading-ui text-text-primary">
            {unit.title || unit.unitId}
          </h3>
          <div className="mt-1 flex min-w-0 items-center gap-1 text-xs leading-dense text-text-secondary">
            {unit.catalogEntryKind === "VARIANT" ? (
              <span className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5">
                Variant
              </span>
            ) : null}
            {context ? (
              <span className="flex min-w-0 items-center gap-1">
                <Layers2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{context.title}</span>
              </span>
            ) : null}
          </div>
        </div>
      </Link>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
        <div
          className="h-full rounded-full bg-brand-fill"
          style={{ width: formatProgress(row.progress.progress) }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs leading-dense text-text-tertiary">
        <span>{row.progress.status}</span>
        <span className="tabular-nums">
          {formatProgress(row.progress.progress)}
        </span>
      </div>
      {row.shelves.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {row.shelves.map((shelf) => (
            <AppSafeLink
              key={`${unit.unitId}:${shelf.shelfUnitId}`}
              href={`/shelf/${shelf.shelfUnitId}`}
              className="rounded-md bg-surface-sunken px-2 py-1 text-xs leading-dense text-text-secondary hover:text-text-primary"
            >
              {shelf.title}
            </AppSafeLink>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function ProgressLibraryGrid({
  rows,
  emptyState,
}: ProgressLibraryGridProps) {
  const renderableRows = rows.filter((row) =>
    Boolean(libraryKindFromUnitType(row.progressUnit.unitType)),
  );

  if (renderableRows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  // Progress rows reuse the shelf cover rhythm, but the DTO stays the source of
  // truth because progress and shelves invert the unit/context priority.
  return (
    <div
      className={cn(
        "grid gap-4",
        "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
      )}
    >
      {renderableRows.map((row) => (
        <ProgressLibraryCard key={row.progress.unitId} row={row} />
      ))}
    </div>
  );
}

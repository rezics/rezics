import { shelfListQuery } from "@rezics/api/shelf";
import { Spinner } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import { ShelfCard } from "../components/ShelfCard";

interface ShelfByBookPageProps {
  bookId: string;
}

export function ShelfByBookPage({ bookId }: ShelfByBookPageProps) {
  const { data, isLoading } = useQuery(
    shelfListQuery({ containsItemRef: bookId, limit: 50 }),
  );

  const shelves = data?.shelves ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold">
        Shelves containing this book
      </h1>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : shelves.length === 0 ? (
        <p className="py-8 text-center text-rezics-color-fg-muted">
          No shelves found for this book
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {shelves.map((shelf) => (
            <ShelfCard key={shelf.unitId} shelf={shelf} />
          ))}
        </div>
      )}
    </div>
  );
}

export default ShelfByBookPage;

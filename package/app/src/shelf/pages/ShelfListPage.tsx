import { shelfListQuery } from "@rezics/api/shelf";
import { Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ShelfCard } from "../components/ShelfCard";

export function ShelfListPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery(
    shelfListQuery({ sort: { field: "createdAt", order: "desc" }, limit: 20 }),
  );

  const shelves = data?.shelves ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-6 flex flex-row items-center justify-between">
        <h1 className="text-2xl font-semibold">Shelves</h1>
        <div className="flex flex-row gap-2">
          <Button
            variant="ghost"
            onClick={() => navigate({ to: "/shelf/search" })}
          >
            Search
          </Button>
          <Button onClick={() => navigate({ to: "/shelf/new" })}>
            New Shelf
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : shelves.length === 0 ? (
        <p className="py-8 text-center text-rezics-color-fg-muted">
          No shelves yet
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

export default ShelfListPage;

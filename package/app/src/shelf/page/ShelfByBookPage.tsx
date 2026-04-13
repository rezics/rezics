import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { shelfListQuery } from "@rezics/api/shelf";
import { useQuery } from "@tanstack/react-query";
import { ShelfCard } from "../component/ShelfCard";

interface ShelfByBookPageProps {
  bookId: string;
}

export function ShelfByBookPage({ bookId }: ShelfByBookPageProps) {
  const { data, isLoading } = useQuery(
    shelfListQuery({ containsItemUnitId: bookId, limit: 50 }),
  );

  const shelves = data?.shelves ?? [];

  return (
    <Box maxWidth="lg" mx="auto" px={2} py={3}>
      <Typography variant="h5" fontWeight={600} mb={3}>
        Shelves containing this book
      </Typography>

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : shelves.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py={4}>
          No shelves found for this book
        </Typography>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {shelves.map((shelf) => (
            <ShelfCard key={shelf.unitId} shelf={shelf} />
          ))}
        </div>
      )}
    </Box>
  );
}

export default ShelfByBookPage;

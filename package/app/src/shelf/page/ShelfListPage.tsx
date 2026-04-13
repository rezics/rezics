import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { useQuery } from "@tanstack/react-query";
import { shelfListQuery } from "@rezics/api/shelf";
import { useNavigate } from "@tanstack/react-router";
import { ShelfCard } from "../component/ShelfCard";

export function ShelfListPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery(
    shelfListQuery({ sort: { field: "createdAt", order: "desc" }, limit: 20 }),
  );

  const shelves = data?.shelves ?? [];

  return (
    <Box maxWidth="lg" mx="auto" px={2} py={3}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h5" fontWeight={600}>
          Shelves
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="text"
            onClick={() => navigate({ to: "/shelf/search" })}
          >
            Search
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={() => navigate({ to: "/shelf/new" })}
          >
            New Shelf
          </Button>
        </Stack>
      </Stack>

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : shelves.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py={4}>
          No shelves yet
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

export default ShelfListPage;

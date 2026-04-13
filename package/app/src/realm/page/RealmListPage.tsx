import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { realmListQuery } from "@rezics/api/realm/realm";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { RealmCard } from "../component/RealmCard";

export function RealmListPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery(
    realmListQuery({ sort: { field: "memberCount", order: "desc" }, limit: 20 }),
  );

  const realms = data?.realms ?? [];

  return (
    <Box maxWidth="lg" mx="auto" px={2} py={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={600}>Realms</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="text" onClick={() => navigate({ to: "/realm/search" })}>Search</Button>
          <Button variant="contained" disableElevation onClick={() => navigate({ to: "/realm/new" })}>New Realm</Button>
        </Stack>
      </Stack>

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
      ) : realms.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py={4}>No realms yet</Typography>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {realms.map((realm) => (<RealmCard key={realm.unitId} realm={realm} />))}
        </div>
      )}
    </Box>
  );
}

export default RealmListPage;

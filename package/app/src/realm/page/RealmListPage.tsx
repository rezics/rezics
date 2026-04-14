import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useRealmSearchQuery } from "@rezics/api/meili/meili.queries";
import type { RealmDTO, RealmSearchDocument } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import { RealmCard } from "../component/RealmCard";

function mapRealmSearchDocToRealmDTO(doc: RealmSearchDocument): RealmDTO {
  return {
    unitId: doc.id,
    userId: doc.userId,
    isPublic: doc.isPublic,
    isOfficial: doc.isOfficial,
    memberCount: doc.memberCount,
    extra: doc.extra as any,
    translations: doc.translations.map((tr) => ({
      unitId: doc.id,
      language: tr.language,
      title: tr.title,
      description: tr.description,
    })),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function RealmListPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useRealmSearchQuery({
    isPublic: true,
    sort: { field: "memberCount", order: "desc" },
    limit: 20,
  });

  const realms = data?.items?.map(mapRealmSearchDocToRealmDTO) ?? [];

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

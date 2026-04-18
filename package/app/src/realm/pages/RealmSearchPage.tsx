import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { useRealmSearchQuery } from "@rezics/api/meili/meili.queries";
import type { RealmDTO, RealmSearchDocument } from "@rezics/contract";
import { useState } from "react";
import { TextSearchInputWithIcon } from "@/search/components/TextSearchInputWithIcon";
import { RealmCard } from "../components/RealmCard";

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

export function RealmSearchPage() {
  const [keyword, setKeyword] = useState("");

  const { data, isLoading } = useRealmSearchQuery({
    keyword: keyword || undefined,
  });

  const realms = data?.items?.map(mapRealmSearchDocToRealmDTO) ?? [];
  const hasKeyword = keyword.length > 0;

  return (
    <Box maxWidth="lg" mx="auto" px={2} py={3}>
      <Typography variant="h5" fontWeight={600} mb={3}>
        Search Realms
      </Typography>
      <Box mb={3}>
        <TextSearchInputWithIcon
          onSearch={(info) => setKeyword(info ?? "")}
          defaultValue={{ keyword }}
          placeholder="Search realms..."
        />
      </Box>
      {isLoading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : hasKeyword && realms.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py={4}>
          No realms found
        </Typography>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {realms.map((realm) => (
            <RealmCard key={realm.unitId} realm={realm} />
          ))}
        </div>
      )}
    </Box>
  );
}

export default RealmSearchPage;

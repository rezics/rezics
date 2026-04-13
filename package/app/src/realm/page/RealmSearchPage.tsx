import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { realmSearchQuery } from "@rezics/api/realm/realm";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { TextSearchInputWithIcon } from "@/search/component/TextSearchInputWithIcon";
import { RealmCard } from "../component/RealmCard";

export function RealmSearchPage() {
  const [keyword, setKeyword] = useState("");

  const { data, isLoading } = useQuery({
    ...realmSearchQuery(keyword),
    enabled: keyword.length > 0,
  });

  const realms = data?.realms ?? [];

  return (
    <Box maxWidth="lg" mx="auto" px={2} py={3}>
      <Typography variant="h5" fontWeight={600} mb={3}>Search Realms</Typography>
      <Box mb={3}>
        <TextSearchInputWithIcon
          onSearch={(info) => setKeyword(info ?? "")}
          defaultValue={{ keyword }}
          placeholder="Search realms..."
        />
      </Box>
      {isLoading ? (
        <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
      ) : keyword && realms.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py={4}>No realms found</Typography>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {realms.map((realm) => (<RealmCard key={realm.unitId} realm={realm} />))}
        </div>
      )}
    </Box>
  );
}

export default RealmSearchPage;

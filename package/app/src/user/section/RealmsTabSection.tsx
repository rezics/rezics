import { Box, Chip, Typography } from "@mui/material";
import { realmQueries } from "@rezics/api/realm/realm.queries";
import {
  realmSearchQueryOptions,
  useRealmSearchQuery,
} from "@rezics/api/meili/meili.queries";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useQuery } from "@tanstack/react-query";
import { useState, type FC } from "react";
import { useProfileContext } from "@/user/component/ProfileShell";
import {
  InnerFilterPanel,
  type ChipDefinition,
} from "@/user/component/InnerFilterPanel";

const FILTER_CHIPS: ChipDefinition[] = [
  { value: "joined", label: "Joined" },
  { value: "created", label: "Created" },
];

export const RealmsTabSection: FC = () => {
  const { unitId, isCurrentUser } = useProfileContext();
  const [filter, setFilter] = useState("joined");

  // For "joined" — use myRealms (returns realms the current user is a member of)
  const joinedQuery = useQuery({
    ...realmQueries.mine(),
    enabled: filter === "joined" && isCurrentUser,
  });

  // For "created" — use realm search filtered by userId
  const createdQuery = useRealmSearchQuery({
    sort: { field: "createdAt", order: "desc" },
    limit: 50,
  });

  const isLoading =
    filter === "joined" ? joinedQuery.isLoading : createdQuery.isLoading;

  const joinedRealms = (joinedQuery.data as any[]) ?? [];
  const createdRealms = (createdQuery.data?.items ?? []).filter(
    (r: any) => r.userId === unitId,
  );

  const realms = filter === "joined" ? joinedRealms : createdRealms;

  return (
    <div className="flex flex-col gap-4 py-4">
      <InnerFilterPanel
        chips={FILTER_CHIPS}
        activeValue={filter}
        onChipChange={setFilter}
      />

      {isLoading ? (
        <Typography variant="body2" color="text.secondary" className="py-8 text-center">
          Loading...
        </Typography>
      ) : realms.length === 0 ? (
        <Typography variant="body2" color="text.secondary" className="py-8 text-center">
          {filter === "joined"
            ? "Not a member of any realms yet"
            : "No realms created yet"}
        </Typography>
      ) : (
        <div className="flex flex-col gap-2">
          {realms.map((realm: any) => (
            <RealmListItem key={realm.unitId ?? realm.id} realm={realm} />
          ))}
        </div>
      )}
    </div>
  );
};

const RealmListItem: FC<{ realm: any }> = ({ realm }) => {
  const realmId = realm.unitId ?? realm.id;
  const title =
    realm.translations?.[0]?.title ?? realm.titles?.[0] ?? realmId;
  const description =
    realm.translations?.[0]?.description ?? realm.descriptions?.[0] ?? "";
  const memberCount = realm.memberCount ?? 0;

  return (
    <Link to="/realm/$realmId" params={{ realmId }} className="no-underline">
      <Box className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Typography variant="body1" className="font-medium" color="text.primary">
                {title}
              </Typography>
              {realm.isOfficial && (
                <Chip label="Official" size="small" color="primary" variant="outlined" />
              )}
              {realm.isPublic === false && (
                <Chip label="Private" size="small" variant="outlined" />
              )}
            </div>
            {description && (
              <Typography
                variant="body2"
                color="text.secondary"
                className="mt-1 line-clamp-2"
              >
                {description}
              </Typography>
            )}
          </div>
          <Typography variant="body2" color="text.secondary" className="shrink-0">
            {memberCount} members
          </Typography>
        </div>
      </Box>
    </Link>
  );
};

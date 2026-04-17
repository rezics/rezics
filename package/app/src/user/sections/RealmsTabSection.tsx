import { Box, Chip, Typography } from "@mui/material";
import { useRealmSearchQuery } from "@rezics/api/meili/meili.queries";
import { realmQueries } from "@rezics/api/realm/realm.queries";
import type { RealmDTO, RealmSearchDocument } from "@rezics/contract";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useQuery } from "@tanstack/react-query";
import { type FC, useState } from "react";
import {
  type ChipDefinition,
  InnerFilterPanel,
} from "@/user/components/InnerFilterPanel";
import { useProfileContext } from "@/user/components/ProfileLayout";

const FILTER_CHIPS: ChipDefinition[] = [
  { value: "joined", label: "Joined" },
  { value: "created", label: "Created" },
];

type RealmListItemModel = {
  unitId: string;
  title: string;
  description: string;
  memberCount: number;
  isOfficial: boolean;
  isPublic: boolean;
};

// TODO This mapping capability should be provided by the API; need to explore.
function mapJoinedRealmToListItem(realm: RealmDTO): RealmListItemModel {
  const primaryTranslation = realm.translations?.[0];

  return {
    unitId: realm.unitId,
    title: primaryTranslation?.title ?? realm.unitId,
    description: primaryTranslation?.description ?? "",
    memberCount: realm.memberCount,
    isOfficial: realm.isOfficial,
    isPublic: realm.isPublic,
  };
}

function mapSearchRealmToListItem(
  realm: RealmSearchDocument,
): RealmListItemModel {
  const primaryTranslation = realm.translations[0];

  return {
    unitId: realm.id,
    title: primaryTranslation?.title ?? realm.titles[0] ?? realm.id,
    description: primaryTranslation?.description ?? realm.descriptions[0] ?? "",
    memberCount: realm.memberCount,
    isOfficial: realm.isOfficial,
    isPublic: realm.isPublic,
  };
}

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

  const activeQuery = filter === "joined" ? joinedQuery : createdQuery;
  const isLoading = activeQuery.isLoading;
  const errorMessage =
    activeQuery.error instanceof Error
      ? activeQuery.error.message
      : activeQuery.error
        ? "Failed to load realms"
        : null;

  const joinedRealms =
    joinedQuery.data?.realms.map(mapJoinedRealmToListItem) ?? [];
  const createdRealms =
    createdQuery.data?.items
      .filter((realm) => realm.userId === unitId)
      .map(mapSearchRealmToListItem) ?? [];

  const realms = filter === "joined" ? joinedRealms : createdRealms;
  const emptyMessage =
    filter === "joined"
      ? "Not a member of any realms yet"
      : "No realms created yet";

  return (
    <div className="flex flex-col gap-4 py-4">
      <InnerFilterPanel
        chips={FILTER_CHIPS}
        activeValue={filter}
        onChipChange={setFilter}
      />

      {isLoading ? (
        <Typography
          variant="body2"
          color="text.secondary"
          className="py-8 text-center"
        >
          Loading...
        </Typography>
      ) : errorMessage ? (
        <Typography variant="body2" color="error" className="py-8 text-center">
          {errorMessage}
        </Typography>
      ) : realms.length === 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          className="py-8 text-center"
        >
          {emptyMessage}
        </Typography>
      ) : (
        <div className="flex flex-col gap-2">
          {realms.map((realm) => (
            <RealmListItem key={realm.unitId} realm={realm} />
          ))}
        </div>
      )}
    </div>
  );
};

const RealmListItem: FC<{ realm: RealmListItemModel }> = ({ realm }) => {
  return (
    <Link
      to="/realm/$realmId"
      params={{ realmId: realm.unitId }}
      className="no-underline"
    >
      <Box className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Typography
                variant="body1"
                className="font-medium"
                color="text.primary"
              >
                {realm.title}
              </Typography>
              {realm.isOfficial && (
                <Chip
                  label="Official"
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
              {!realm.isPublic && (
                <Chip label="Private" size="small" variant="outlined" />
              )}
            </div>
            {realm.description && (
              <Typography
                variant="body2"
                color="text.secondary"
                className="mt-1 line-clamp-2"
              >
                {realm.description}
              </Typography>
            )}
          </div>
          <Typography
            variant="body2"
            color="text.secondary"
            className="shrink-0"
          >
            {realm.memberCount} members
          </Typography>
        </div>
      </Box>
    </Link>
  );
};

import { useRealmSearchQuery } from "@rezics/api/meili/meili.queries";
import { realmQueries } from "@rezics/api/realm/realm.queries";
import type { RealmDTO, RealmSearchDocument } from "@rezics/contract";
import { Badge } from "@rezics/ui/shadcn";
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
        <p className="text-sm text-rezics-color-fg-muted py-12 text-center">
          Loading...
        </p>
      ) : errorMessage ? (
        <p className="text-sm text-rezics-color-danger py-12 text-center">
          {errorMessage}
        </p>
      ) : realms.length === 0 ? (
        <p className="text-sm text-rezics-color-fg-muted py-12 text-center">
          {emptyMessage}
        </p>
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
      <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-medium text-rezics-color-fg">
                {realm.title}
              </span>
              {realm.isOfficial && (
                <Badge variant="outline" className="text-rezics-color-primary">
                  Official
                </Badge>
              )}
              {!realm.isPublic && <Badge variant="outline">Private</Badge>}
            </div>
            {realm.description && (
              <p className="text-sm text-rezics-color-fg-muted mt-1 line-clamp-2">
                {realm.description}
              </p>
            )}
          </div>
          <span className="text-sm text-rezics-color-fg-muted shrink-0">
            {realm.memberCount} members
          </span>
        </div>
      </div>
    </Link>
  );
};

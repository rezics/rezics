import { realmQueries } from "@rezics/api/realm/realm.queries";
import type { RealmDTO } from "@rezics/contract";
import { Link, unitHref } from "@rezics/ui/primitive/link";
import { Badge } from "@rezics/ui/shadcn";
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
  slug: string | null;
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
    slug: realm.slug ?? null,
    title: primaryTranslation?.title ?? realm.unitId,
    description: primaryTranslation?.description ?? "",
    memberCount: realm.memberCount,
    isOfficial: realm.isOfficial,
    isPublic: realm.isPublic,
  };
}

export const RealmsTabSection: FC = () => {
  const { userId } = useProfileContext();
  const [filter, setFilter] = useState("joined");

  const joinedQuery = useQuery({
    ...realmQueries.byMember(userId),
    enabled: filter === "joined",
  });

  const createdQuery = useQuery({
    ...realmQueries.list({
      userId,
      sort: { field: "createdAt", order: "desc" },
      limit: 50,
    }),
    enabled: filter === "created",
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
    createdQuery.data?.realms.map(mapJoinedRealmToListItem) ?? [];

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
        <p className="text-sm text-text-secondary py-12 text-center">
          Loading...
        </p>
      ) : errorMessage ? (
        <p className="text-sm text-error-text py-12 text-center">
          {errorMessage}
        </p>
      ) : realms.length === 0 ? (
        <p className="text-sm text-text-secondary py-12 text-center">
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
      to={unitHref({
        type: "REALM",
        unitId: realm.unitId,
        slug: realm.slug,
      })}
      className="no-underline"
    >
      <div className="border border-border-whisper rounded-lg p-4 hover:border-border-defined transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-medium text-text-primary">
                {realm.title}
              </span>
              {realm.isOfficial && (
                <Badge variant="outline" className="text-text-brand">
                  Official
                </Badge>
              )}
              {!realm.isPublic && <Badge variant="outline">Private</Badge>}
            </div>
            {realm.description && (
              <p className="text-sm text-text-secondary mt-1 line-clamp-2">
                {realm.description}
              </p>
            )}
          </div>
          <span className="text-sm text-text-secondary shrink-0">
            {realm.memberCount} members
          </span>
        </div>
      </div>
    </Link>
  );
};

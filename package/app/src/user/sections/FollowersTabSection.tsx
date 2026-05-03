import { Avatar, Box, Typography } from "@mui/material";
import { userQueries } from "@rezics/api/user/user.queries";
import type { UserDTO } from "@rezics/contract";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useQuery } from "@tanstack/react-query";
import { type FC, useState } from "react";
import FollowButton from "@/engagement/components/FollowButton";
import {
  type ChipDefinition,
  InnerFilterPanel,
} from "@/user/components/InnerFilterPanel";
import { useProfileContext } from "@/user/components/ProfileLayout";

export const FollowersTabSection: FC = () => {
  const { user, unitId, isCurrentUser } = useProfileContext();
  const [filter, setFilter] = useState("followers");
  const [page, setPage] = useState(1);
  const limit = 20;

  const chips: ChipDefinition[] = [
    { value: "followers", label: "Followers", count: user.followersCount ?? 0 },
    {
      value: "following",
      label: "Following",
      count: user.followingsCount ?? 0,
    },
  ];

  const followersQuery = useQuery({
    ...userQueries.followers(unitId, { page, limit }),
    enabled: filter === "followers",
  });

  const followingsQuery = useQuery({
    ...userQueries.followings(unitId, { page, limit }),
    enabled: filter === "following",
  });

  const isLoading =
    filter === "followers"
      ? followersQuery.isLoading
      : followingsQuery.isLoading;

  const rawData: any =
    filter === "followers" ? followersQuery.data : followingsQuery.data;
  const users: UserDTO[] = rawData?.users ?? rawData ?? [];
  const total: number = rawData?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const handleFilterChange = (value: string) => {
    setFilter(value);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4 py-4">
      <InnerFilterPanel
        chips={chips}
        activeValue={filter}
        onChipChange={handleFilterChange}
      />

      {isLoading ? (
        <Typography
          variant="body2"
          color="text.secondary"
          className="py-12 text-center"
        >
          Loading...
        </Typography>
      ) : users.length === 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          className="py-12 text-center"
        >
          {filter === "followers"
            ? "No followers yet"
            : "Not following anyone yet"}
        </Typography>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {users.map((u: UserDTO) => (
              <UserListItem
                key={u.unitId}
                user={u}
                showFollowButton={isCurrentUser}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <Typography variant="body2" color="text.secondary">
                Page {page} of {totalPages}
              </Typography>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const UserListItem: FC<{ user: UserDTO; showFollowButton: boolean }> = ({
  user,
  showFollowButton,
}) => (
  <Box className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
    <Link
      to="/user/$unitId"
      params={{ unitId: user.unitId }}
      className="no-underline"
    >
      <Avatar src={user.avatar ?? undefined} sx={{ width: 40, height: 40 }}>
        {user.name?.charAt(0).toUpperCase()}
      </Avatar>
    </Link>
    <div className="flex-1 min-w-0">
      <Link
        to="/user/$unitId"
        params={{ unitId: user.unitId }}
        className="no-underline"
      >
        <Typography
          variant="body2"
          className="font-medium"
          color="text.primary"
        >
          {user.name}
        </Typography>
        {user.slug && (
          <Typography variant="caption" color="text.secondary">
            @{user.slug}
          </Typography>
        )}
      </Link>
      {user.bio && (
        <Typography
          variant="caption"
          color="text.secondary"
          className="block truncate mt-0.5"
        >
          {user.bio}
        </Typography>
      )}
    </div>
    {showFollowButton && <FollowButton userId={user.unitId} size="small" />}
  </Box>
);

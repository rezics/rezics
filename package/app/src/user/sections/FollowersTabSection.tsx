import { userQueries } from "@rezics/api/user/user.queries";
import type { UserDTO } from "@rezics/contract";
import {
  common_loading,
  common_next_page,
  common_page_of,
  common_previous_page,
  profile_following,
  profile_no_followers,
  profile_no_following,
  profile_tab_followers,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { Avatar, AvatarFallback, AvatarImage, Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { type FC, useState } from "react";
import FollowButton from "@/engagement/components/FollowButton";
import { Link, unitHref } from "@/shared/ui/link";
import {
  type ChipDefinition,
  InnerFilterPanel,
} from "@/user/components/InnerFilterPanel";
import { useProfileContext } from "@/user/components/ProfileLayout";

const i18nMessages = {
  common_loading,
  common_next_page,
  common_page_of,
  common_previous_page,
  profile_following,
  profile_no_followers,
  profile_no_following,
  profile_tab_followers,
};

export const FollowersTabSection: FC = () => {
  const m = useMessage(i18nMessages);
  const { user, userId, isCurrentUser } = useProfileContext();
  const [filter, setFilter] = useState("followers");
  const [page, setPage] = useState(1);
  const limit = 20;

  const chips: ChipDefinition[] = [
    {
      value: "followers",
      label: m.profile_tab_followers(),
      count: user.followersCount ?? 0,
    },
    {
      value: "following",
      label: m.profile_following(),
      count: user.followingsCount ?? 0,
    },
  ];

  const followersQuery = useQuery({
    ...userQueries.followers(userId, { page, limit }),
    enabled: filter === "followers",
  });

  const followingsQuery = useQuery({
    ...userQueries.followings(userId, { page, limit }),
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
        <p className="text-sm text-text-secondary py-12 text-center">
          {m.common_loading()}
        </p>
      ) : users.length === 0 ? (
        <p className="text-sm text-text-secondary py-12 text-center">
          {filter === "followers"
            ? m.profile_no_followers()
            : m.profile_no_following()}
        </p>
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                {m.common_previous_page()}
              </Button>
              <span className="text-sm text-text-secondary">
                {m.common_page_of({ page, total: totalPages })}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
              >
                {m.common_next_page()}
              </Button>
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
}) => {
  const href = unitHref({
    type: "USER",
    unitId: user.unitId,
    slug: user.slug ?? null,
  });
  return (
    <div className="flex items-center gap-3 p-3 border border-border-whisper rounded-lg hover:border-border-defined transition-colors">
      <Link to={href} className="no-underline">
        <Avatar className="w-10 h-10">
          <AvatarImage src={user.avatar ?? undefined} alt={user.name ?? ""} />
          <AvatarFallback>{user.name?.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex-1 min-w-0">
        <Link to={href} className="no-underline">
          <span className="block text-sm font-medium text-text-primary">
            {user.name}
          </span>
          {user.slug && (
            <span className="block text-xs text-text-secondary">
              @{user.slug}
            </span>
          )}
        </Link>
        {user.bio && (
          <span className="block text-xs text-text-secondary truncate mt-0.5">
            {user.bio}
          </span>
        )}
      </div>
      {showFollowButton && <FollowButton userId={user.unitId} size="sm" />}
    </div>
  );
};

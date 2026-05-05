import { useCanEdit } from "@rezics/api/hooks";
import { contentSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import type { UserDTO } from "@rezics/contract";
import { Avatar, AvatarFallback, AvatarImage, Button } from "@rezics/ui/shadcn";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useQuery } from "@tanstack/react-query";
import { Pencil as EditOutlined, Settings as SettingsIcon } from "lucide-react";
import type { FC } from "react";
import FollowButton from "@/engagement/components/FollowButton";

interface ProfileBasicInfoProps {
  user: UserDTO;
  isCurrentUser: boolean;
  unitId: string;
}

export const ProfileBasicInfo: FC<ProfileBasicInfoProps> = ({
  user,
  isCurrentUser,
  unitId,
}) => {
  const canEdit = useCanEdit({
    resource: "unit",
    ownerUnit: { user: { unitId: user.unitId } },
  });
  const shelvesCountQuery = useQuery({
    ...contentSearchQueryOptions({
      type: ["SHELF"],
      sort: { field: "createdAt", order: "desc" },
      limit: 0,
    }),
  });

  const reviewsCountQuery = useQuery({
    ...contentSearchQueryOptions({
      type: ["POST"],
      sort: { field: "createdAt", order: "desc" },
      limit: 0,
    }),
  });

  return (
    <>
      {/* Mobile: compact horizontal layout */}
      <div className="relative flex items-start gap-4 py-4 px-4 md:hidden">
        {isCurrentUser && (
          <Link to="/user/me/setting" className="absolute top-3 right-3">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Settings"
              className="h-8 w-8"
            >
              <SettingsIcon className="w-4 h-4" />
            </Button>
          </Link>
        )}
        <Avatar className="w-[72px] h-[72px] rounded-md text-3xl">
          <AvatarImage src={user.avatar ?? undefined} alt={user.name ?? ""} />
          <AvatarFallback>{user.name?.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <h6 className="text-base font-semibold">{user.name}</h6>
            {canEdit && (
              <Link to="/user/$unitId/edit" params={{ unitId }}>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Edit profile"
                  className="h-8 w-8"
                >
                  <EditOutlined className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </div>
          {user.slug && (
            <span className="block text-sm text-text-secondary">
              @{user.slug}
            </span>
          )}
          <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
            <span>
              <strong>{user.followersCount ?? 0}</strong> followers
            </span>
            <span>&middot;</span>
            <span>
              <strong>{user.followingsCount ?? 0}</strong> following
            </span>
          </div>
          {user.bio && (
            <p className="text-sm text-text-secondary mt-2 line-clamp-2">
              {user.bio}
            </p>
          )}
          {!isCurrentUser && (
            <div className="mt-3">
              <FollowButton
                userId={user.unitId}
                size="small"
                variant="contained"
              />
            </div>
          )}
        </div>
      </div>

      {/* Desktop: generous vertical layout */}
      <div className="hidden md:flex flex-col items-start gap-4 py-12 px-4">
        <Avatar className="w-full h-auto aspect-square rounded-lg text-5xl">
          <AvatarImage src={user.avatar ?? undefined} alt={user.name ?? ""} />
          <AvatarFallback>{user.name?.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>

        <div>
          <h5 className="text-xl font-semibold">{user.name}</h5>
          {user.slug && (
            <span className="block text-sm text-text-secondary mt-0.5">
              @{user.slug}
            </span>
          )}
        </div>

        {user.bio && (
          <p className="text-sm text-text-secondary max-w-xs">{user.bio}</p>
        )}

        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>
            <strong>{user.followersCount ?? 0}</strong> followers
          </span>
          <span>&middot;</span>
          <span>
            <strong>{user.followingsCount ?? 0}</strong> following
          </span>
        </div>

        <div className="w-full">
          {canEdit ? (
            <Link to="/user/$unitId/edit" params={{ unitId }} className="block">
              <Button variant="outline" size="sm" className="w-full">
                Edit profile
              </Button>
            </Link>
          ) : (
            <FollowButton
              userId={user.unitId}
              size="medium"
              variant="contained"
              fullWidth
            />
          )}
        </div>

        {/* Stats — desktop only, shown in sidebar */}
        <div className="w-full mt-4 flex flex-col gap-1">
          <span className="text-sm font-semibold mb-1">Stats</span>
          <StatLink
            label="Shelves"
            count={shelvesCountQuery.data?.total}
            to={`/user/${unitId}/shelves`}
          />
          <StatLink
            label="Content"
            count={reviewsCountQuery.data?.total}
            to={`/user/${unitId}/content`}
          />
          <StatLink
            label="Followers"
            count={user.followersCount ?? 0}
            to={`/user/${unitId}/followers`}
          />
          <StatLink
            label="Following"
            count={user.followingsCount ?? 0}
            to={`/user/${unitId}/followers?filter=following`}
          />
        </div>
      </div>
    </>
  );
};

const StatLink: FC<{
  label: string;
  count: number | undefined;
  to: string;
}> = ({ label, count, to }) => (
  <Link to={to} className="no-underline">
    <div className="flex items-center justify-between py-0.5 hover:bg-gray-50 rounded px-1">
      <span className="text-sm text-text-primary">{label}</span>
      <span className="text-sm font-medium text-text-secondary">
        {count ?? "—"}
      </span>
    </div>
  </Link>
);

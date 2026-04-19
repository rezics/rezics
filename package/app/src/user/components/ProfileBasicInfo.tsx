import { EditOutlined } from "@mui/icons-material";
import SettingsIcon from "@mui/icons-material/Settings";
import { Avatar, Box, Button, IconButton, Typography } from "@mui/material";
import { useCanEdit } from "@rezics/api/hooks";
import { contentSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import type { UserDTO } from "@rezics/contract";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useQuery } from "@tanstack/react-query";
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
            <IconButton size="small">
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Link>
        )}
        <Avatar
          src={user.avatar ?? undefined}
          variant="rounded"
          sx={{ width: 72, height: 72, borderRadius: 2, fontSize: 32 }}
        >
          {user.name?.charAt(0).toUpperCase()}
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <Typography variant="h6" className="font-semibold">
              {user.name}
            </Typography>
            {canEdit && (
              <Link to="/user/$unitId/edit" params={{ unitId }}>
                <IconButton size="small" aria-label="Edit profile">
                  <EditOutlined fontSize="small" />
                </IconButton>
              </Link>
            )}
          </div>
          {user.slug && (
            <Typography variant="body2" color="text.secondary">
              @{user.slug}
            </Typography>
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
            <Typography
              variant="body2"
              color="text.secondary"
              className="mt-2 line-clamp-2"
            >
              {user.bio}
            </Typography>
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
      <div className="hidden md:flex flex-col items-start gap-4 py-8 px-4">
        <Avatar
          src={user.avatar ?? undefined}
          variant="rounded"
          sx={{
            width: "100%",
            height: "auto",
            aspectRatio: "1",
            borderRadius: 3,
            fontSize: 48,
          }}
        >
          {user.name?.charAt(0).toUpperCase()}
        </Avatar>

        <div>
          <Typography variant="h5" className="font-semibold">
            {user.name}
          </Typography>
          {user.slug && (
            <Typography
              variant="body2"
              color="text.secondary"
              className="mt-0.5"
            >
              @{user.slug}
            </Typography>
          )}
        </div>

        {user.bio && (
          <Typography
            variant="body2"
            color="text.secondary"
            className="max-w-xs"
          >
            {user.bio}
          </Typography>
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
              <Button variant="outlined" size="small" fullWidth>
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
          <Typography variant="subtitle2" className="font-semibold mb-1">
            Stats
          </Typography>
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
    <Box className="flex items-center justify-between py-0.5 hover:bg-gray-50 rounded px-1">
      <Typography variant="body2" color="text.primary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        className="font-medium"
      >
        {count ?? "—"}
      </Typography>
    </Box>
  </Link>
);

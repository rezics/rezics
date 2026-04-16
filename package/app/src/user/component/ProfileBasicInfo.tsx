import SettingsIcon from "@mui/icons-material/Settings";
import { Avatar, Button, IconButton, Typography } from "@mui/material";
import type { UserDTO } from "@rezics/contract";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import type { FC } from "react";
import FollowButton from "@/engagement/component/FollowButton";

interface ProfileBasicInfoProps {
  user: UserDTO;
  isCurrentUser: boolean;
}

export const ProfileBasicInfo: FC<ProfileBasicInfoProps> = ({
  user,
  isCurrentUser,
}) => (
  <div className="flex flex-col items-center gap-4 py-8 px-4 md:items-start md:py-6">
    <Avatar
      src={user.avatar ?? undefined}
      variant="rounded"
      sx={{ width: 120, height: 120, borderRadius: 3, fontSize: 48 }}
    >
      {user.name?.charAt(0).toUpperCase()}
    </Avatar>

    <div className="text-center md:text-left">
      <Typography variant="h5" className="font-semibold">
        {user.name}
      </Typography>
      {user.slug && (
        <Typography variant="body2" color="text.secondary" className="mt-0.5">
          @{user.slug}
        </Typography>
      )}
    </div>

    {user.bio && (
      <Typography variant="body2" color="text.secondary" className="max-w-xs">
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

    <div className="flex items-center gap-2">
      {isCurrentUser ? (
        <>
          <Link to="/user/me/settings/profile">
            <Button variant="outlined" size="small">
              Edit profile
            </Button>
          </Link>
          <Link to="/user/me/settings">
            <IconButton size="small">
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Link>
        </>
      ) : (
        <FollowButton userId={user.unitId} size="medium" variant="contained" />
      )}
    </div>
  </div>
);

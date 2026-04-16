import SettingsIcon from "@mui/icons-material/Settings";
import { Avatar, Box, Button, IconButton, Typography } from "@mui/material";
import type { UserDTO } from "@rezics/contract";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import type { FC } from "react";
import FollowButton from "@/engagement/component/FollowButton";

interface ProfileHeaderFullProps {
  user: UserDTO;
  isCurrentUser: boolean;
}

export const ProfileHeaderFull: FC<ProfileHeaderFullProps> = ({
  user,
  isCurrentUser,
}) => (
  <Box className="flex flex-col items-center gap-3 py-6 px-4">
    <Avatar src={user.avatar ?? undefined} sx={{ width: 96, height: 96 }}>
      {user.name?.charAt(0).toUpperCase()}
    </Avatar>
    <div className="text-center">
      <Typography variant="h5" className="font-semibold">
        {user.name}
      </Typography>
      {user.slug && (
        <Typography variant="body2" color="text.secondary">
          @{user.slug}
        </Typography>
      )}
    </div>
    {user.bio && (
      <Typography
        variant="body2"
        color="text.secondary"
        className="text-center max-w-sm"
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
  </Box>
);

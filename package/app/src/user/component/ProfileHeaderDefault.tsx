import SettingsIcon from "@mui/icons-material/Settings";
import { Avatar, Box, Button, IconButton, Typography } from "@mui/material";
import type { UserDTO } from "@rezics/contract";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import type { FC } from "react";
import FollowButton from "@/engagement/component/FollowButton";

interface ProfileHeaderDefaultProps {
  user: UserDTO;
  isCurrentUser: boolean;
}

export const ProfileHeaderDefault: FC<ProfileHeaderDefaultProps> = ({
  user,
  isCurrentUser,
}) => (
  <Box className="flex items-start gap-5 py-5 px-4">
    <Avatar src={user.avatar ?? undefined} sx={{ width: 64, height: 64 }}>
      {user.name?.charAt(0).toUpperCase()}
    </Avatar>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-3 flex-wrap">
        <Typography variant="h5" className="font-semibold">
          {user.name}
        </Typography>
        {user.slug && (
          <Typography variant="body2" color="text.secondary">
            @{user.slug}
          </Typography>
        )}
        <span className="text-sm text-gray-500">
          <strong>{user.followersCount ?? 0}</strong> followers &middot;{" "}
          <strong>{user.followingsCount ?? 0}</strong> following
        </span>
      </div>
      {user.bio && (
        <Typography variant="body2" color="text.secondary" className="mt-1">
          {user.bio}
        </Typography>
      )}
    </div>
    <div className="flex items-center gap-2 shrink-0">
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
        <FollowButton userId={user.unitId} size="small" variant="contained" />
      )}
    </div>
  </Box>
);

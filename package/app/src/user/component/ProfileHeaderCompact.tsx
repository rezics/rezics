import { Avatar, Typography } from "@mui/material";
import type { UserDTO } from "@rezics/contract";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import type { FC } from "react";

interface ProfileHeaderCompactProps {
  user: UserDTO;
  unitId: string;
}

export const ProfileHeaderCompact: FC<ProfileHeaderCompactProps> = ({
  user,
  unitId,
}) => (
  <Link to="/user/$unitId" params={{ unitId }} className="no-underline">
    <div className="flex items-center gap-2 px-4 py-2">
      <Avatar src={user.avatar ?? undefined} sx={{ width: 24, height: 24 }}>
        {user.name?.charAt(0).toUpperCase()}
      </Avatar>
      <Typography variant="body2" className="font-medium" color="text.primary">
        {user.name}
      </Typography>
      {user.slug && (
        <Typography variant="caption" color="text.secondary">
          @{user.slug}
        </Typography>
      )}
    </div>
  </Link>
);

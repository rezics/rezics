import { Avatar, Box, Chip, Stack, Typography } from "@mui/material";
import type React from "react";

interface RealmMemberListProps {
  realmId: string;
}

export const RealmMemberList: React.FC<RealmMemberListProps> = ({
  realmId: _realmId,
}) => {
  // MOCK: member list not yet available via dedicated endpoint - show placeholder
  return (
    <Box py={2}>
      <Typography variant="body2" color="text.secondary">
        Member list will be available when the members API endpoint is
        implemented.
      </Typography>
    </Box>
  );
};

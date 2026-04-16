import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type React from "react";

interface RealmTagManagerProps {
  realmId: string;
}

export const RealmTagManager: React.FC<RealmTagManagerProps> = ({ realmId: _realmId }) => {
  // MOCK: tag management UI placeholder
  return (
    <Box py={2}>
      <Typography variant="body2" color="text.secondary">
        Tag management will be available when the realm-tag API endpoints are wired up.
      </Typography>
    </Box>
  );
};

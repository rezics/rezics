import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type React from "react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
}) => {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={1.5}
      role="status"
      aria-live="polite"
      sx={{ py: { xs: 4, sm: 6 }, textAlign: "center" }}
    >
      {icon ? (
        <Stack sx={{ color: "text.disabled" }}>{icon}</Stack>
      ) : null}
      <Typography variant="subtitle1" color="text.primary">
        {title}
      </Typography>
      {description ? (
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      ) : null}
      {action ? <Stack sx={{ mt: 1 }}>{action}</Stack> : null}
    </Stack>
  );
};

import { Typography } from "@mui/material";
import type { FC, ReactNode } from "react";

interface DangerZoneProps {
  title?: string;
  description?: string;
  children: ReactNode;
}

export const DangerZone: FC<DangerZoneProps> = ({
  title = "Danger Zone",
  description,
  children,
}) => (
  <section className="mt-6 rounded-lg border border-error/30 p-4">
    <Typography variant="h6" color="error" className="font-semibold mb-1">
      {title}
    </Typography>
    {description && (
      <Typography variant="body2" color="text.secondary" className="mb-4">
        {description}
      </Typography>
    )}
    <div className="mt-4">{children}</div>
  </section>
);

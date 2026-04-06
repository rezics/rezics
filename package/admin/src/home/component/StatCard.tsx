import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Typography,
} from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: ReactNode;
  color?: string;
  href?: string;
}

export function StatCard({ label, value, icon, color, href }: StatCardProps) {
  const navigate = useNavigate();

  const content = (
    <CardContent>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        {icon && (
          <Box sx={{ color: color ?? "primary.main", display: "flex" }}>
            {icon}
          </Box>
        )}
        <Box>
          <Typography variant="overline" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h4" fontWeight={800} sx={{ color }}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </Typography>
        </Box>
      </Box>
    </CardContent>
  );

  if (href) {
    return (
      <Card>
        <CardActionArea onClick={() => navigate({ to: href })}>
          {content}
        </CardActionArea>
      </Card>
    );
  }

  return <Card>{content}</Card>;
}

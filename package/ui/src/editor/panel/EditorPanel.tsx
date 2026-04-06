import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import type { ReactNode } from "react";

export interface EditorPanelProps {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function EditorPanel({ left, right, className }: EditorPanelProps) {
  return (
    <Toolbar
      variant="dense"
      disableGutters
      className={className}
      sx={{
        gap: 0.5,
        px: 1,
        minHeight: 36,
      }}
    >
      {left && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            flexShrink: 0,
          }}
        >
          {left}
        </Box>
      )}
      <Box sx={{ flex: 1 }} />
      {right && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {right}
        </Box>
      )}
    </Toolbar>
  );
}

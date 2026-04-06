import { ChevronLeft, ChevronRight } from "@mui/icons-material";
import { Box, IconButton, useTheme } from "@mui/material";

export function MainSidebarDrawerHeader({
  handleDrawerToggle,
}: {
  handleDrawerToggle: () => void;
}) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        px: 1,
        ...theme.mixins.toolbar, // ensures space below AppBar
        justifyContent: "flex-end",
      }}
    >
      <IconButton onClick={handleDrawerToggle}>
        {theme.direction === "ltr" ? <ChevronLeft /> : <ChevronRight />}
      </IconButton>
    </Box>
  );
}

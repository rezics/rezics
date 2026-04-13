import { Box, Card, CardActionArea, CardContent, Chip, Stack, Typography } from "@mui/material";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import SportsEsportsOutlinedIcon from "@mui/icons-material/SportsEsportsOutlined";
import MovieOutlinedIcon from "@mui/icons-material/MovieOutlined";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";

const libraries = [
  { title: "Book Library", icon: MenuBookOutlinedIcon, to: "/book", active: true },
  { title: "Game Library", icon: SportsEsportsOutlinedIcon, to: "#", active: false },
  { title: "Media Library", icon: MovieOutlinedIcon, to: "#", active: false },
];

export const LibraryCardsSection: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {libraries.map((lib) => (
        <Card key={lib.title} elevation={0}>
          <CardActionArea
            onClick={() => lib.active && navigate({ to: lib.to })}
            disabled={!lib.active}
          >
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <lib.icon sx={{ fontSize: 32 }} color={lib.active ? "primary" : "disabled"} />
                <Box>
                  <Typography variant="h6" fontWeight={600}>
                    {lib.title}
                  </Typography>
                  {!lib.active && (
                    <Chip label="Coming Soon" size="small" variant="outlined" />
                  )}
                </Box>
              </Stack>
            </CardContent>
          </CardActionArea>
        </Card>
      ))}
    </div>
  );
};

import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import MovieOutlinedIcon from "@mui/icons-material/MovieOutlined";
import SportsEsportsOutlinedIcon from "@mui/icons-material/SportsEsportsOutlined";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useTranslation } from "react-i18next";

const libraries = [
  {
    key: "book_library",
    icon: MenuBookOutlinedIcon,
    to: "/book",
    active: true,
  },
  {
    key: "game_library",
    icon: SportsEsportsOutlinedIcon,
    to: "#",
    active: false,
  },
  { key: "media_library", icon: MovieOutlinedIcon, to: "#", active: false },
] as const;

export const LibraryCardsSection: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {libraries.map((lib) => (
        <Card key={lib.key} elevation={0}>
          <CardActionArea
            onClick={() => lib.active && navigate({ to: lib.to })}
            disabled={!lib.active}
          >
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <lib.icon
                  sx={{ fontSize: 32 }}
                  color={lib.active ? "primary" : "disabled"}
                />
                <Box>
                  <Typography variant="h6" fontWeight={600}>
                    {t(`page.home.sections.library_cards.${lib.key}`)}
                  </Typography>
                  {!lib.active && (
                    <Chip
                      label={t("page.home.sections.library_cards.coming_soon")}
                      size="small"
                      variant="outlined"
                    />
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

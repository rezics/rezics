import { Badge, Card, CardContent } from "@rezics/ui/shadcn";
import { Link } from "@tanstack/react-router";
import {
  BookOpen as MenuBookOutlinedIcon,
  Film as MovieOutlinedIcon,
  Gamepad2 as SportsEsportsOutlinedIcon,
} from "lucide-react";
import type React from "react";
import { useTranslation } from "@rezics/i18n/react";

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
    to: "/game",
    active: true,
  },
  {
    key: "media_library",
    icon: MovieOutlinedIcon,
    to: "/media",
    active: true,
  },
] as const;

export const LibraryCardsSection: React.FC = () => {
  const { t } = useTranslation();

  const renderLibraryCard = (lib: (typeof libraries)[number]) => (
    <Link key={lib.key} to={lib.to} className="min-w-0">
      <Card size="sm" className="h-full border-0 shadow-none">
        <CardContent className="px-2 sm:px-4">
          <div className="flex min-w-0 flex-col items-center gap-2 text-center sm:flex-row sm:gap-4 sm:text-left">
            <lib.icon
              className="h-6 w-6 shrink-0 sm:h-8 sm:w-8"
              color={
                lib.active ? "currentColor" : "var(--colors-text-disabled)"
              }
            />
            <div className="min-w-0">
              <h6 className="m-0 truncate text-xs font-semibold leading-tight sm:text-base">
                {t(`page.home.sections.library_cards.${lib.key}`)}
              </h6>
              {!lib.active && (
                <Badge variant="outline" className="text-xs">
                  {t("page.home.sections.library_cards.coming_soon")}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      {libraries.map(renderLibraryCard)}
    </div>
  );
};

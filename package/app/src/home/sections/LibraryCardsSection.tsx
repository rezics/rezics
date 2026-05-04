import { Badge, Card, CardContent } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useTranslation } from "react-i18next";
import { BookOpen as MenuBookOutlinedIcon, Film as MovieOutlinedIcon, Gamepad2 as SportsEsportsOutlinedIcon } from "lucide-react";

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
        <Card key={lib.key} className="border-0 shadow-none">
          <button
            type="button"
            onClick={() => lib.active && navigate({ to: lib.to })}
            disabled={!lib.active}
            className="w-full text-left disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <CardContent>
              <div className="flex flex-row items-center gap-4">
                <lib.icon
                  size={32}
                  color={lib.active ? "currentColor" : "var(--colors-text-disabled)"}
                />
                <div>
                  <h6 className="text-base font-semibold m-0">
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
          </button>
        </Card>
      ))}
    </div>
  );
};

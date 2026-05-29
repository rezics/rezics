import { useTranslation } from "@rezics/i18n/react";
import { Card, CardContent } from "@rezics/ui/shadcn";
import {
  BarChart3,
  BookPlus,
  ListPlus,
  Users as UsersIcon,
  UserPlus,
} from "lucide-react";
import type React from "react";
import { Link } from "@/shared/ui/link";

/**
 * Unified creation entry. Presents the standalone creation flows
 * (book, shelf, realm, entity) as a single type-selection surface; each
 * tile links to the existing route for that flow.
 *
 * Contributor inventory note — chapter creation is intentionally NOT a tile
 * here. A chapter is created contextually from an empty TOC node via the
 * "Create chapter" CTA in `book-read-node/EmptyNodeView`, which reuses the
 * materialization-by-node path (`useEnsureChapterUnit`, accepting a node's
 * `{ path, title }`). This menu must neither duplicate that flow nor hide it:
 * the empty-node CTA remains the recognized chapter-creation entry at
 * `/book/:bookId/node/:nodeId`.
 */
export const CreatePage: React.FC = () => {
  const { t } = useTranslation(["page"]);

  const options: Array<{
    to: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { to: "/book/new", label: t("page:create_book"), icon: BookPlus },
    { to: "/shelf/new", label: t("page:create_shelf"), icon: ListPlus },
    { to: "/realm/new", label: t("page:create_realm"), icon: UsersIcon },
    {
      to: "/user/me/entity/new",
      label: t("page:create_entity"),
      icon: UserPlus,
    },
    { to: "/poll/new", label: t("page:create_poll"), icon: BarChart3 },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-text-primary">
          {t("page:create_title")}
        </h1>
        <p className="text-sm text-text-secondary">
          {t("page:create_subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <Link key={option.to} to={option.to} className="block">
              <Card className="transition-colors hover:bg-surface-sunken">
                <CardContent className="flex items-center gap-3 p-4">
                  <Icon className="h-6 w-6 text-text-secondary" />
                  <span className="font-medium text-text-primary">
                    {option.label}
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

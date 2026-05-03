import type { BookDTO } from "@rezics/contract";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@rezics/ui/shadcn";
import { useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import type React from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useBookLanguage } from "../hooks/useBookLanguage";

const TAB_ROUTES = ["info", "review", "content", "discussion"] as const;
type TabRoute = (typeof TAB_ROUTES)[number];

function useActiveTabRoute(): TabRoute {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return TAB_ROUTES.find((r) => pathname.endsWith(`/${r}`)) ?? "info";
}

export type BookDetailShellProps = {
  bookInfo: BookDTO;
  children: React.ReactNode;
  /** Sidebar content rendered in the right column on lg+. */
  sidebar?: React.ReactNode;
};

/**
 * Shell layout for book detail sub-pages.
 * Renders the tab navigation (as route links) + an optional sidebar,
 * with the routed page content as children.
 */
export const BookDetailShell: React.FC<BookDetailShellProps> = ({
  bookInfo,
  children,
  sidebar,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { bookId } = useParams({ strict: false }) as { bookId: string };
  const activeTab = useActiveTabRoute();
  const [selectedLang, setSelectedLang] = useBookLanguage(bookId, bookInfo);

  const availableLanguages = useMemo(
    () => (bookInfo?.translations ?? []).map((tr) => tr.language as string),
    [bookInfo?.translations],
  );

  const handleTabChange = (newValue: string) => {
    navigate({
      to: `/book/$bookId/${newValue as TabRoute}`,
      params: { bookId },
    });
  };

  const hasSidebar = Boolean(sidebar);

  return (
    <div id="book-detail">
      <div className="mt-4 mb-12 mx-auto max-w-screen-xl">
        <div className="flex flex-row items-center gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList variant="line">
                <TabsTrigger value="info">
                  {t("page.book.tabs.overview")}
                </TabsTrigger>
                <TabsTrigger value="review">
                  {t("page.book.tabs.review_shelf")}
                </TabsTrigger>
                <TabsTrigger value="content">
                  {t("page.book.tabs.content")}
                </TabsTrigger>
                <TabsTrigger value="discussion">
                  {t("page.book.tabs.community")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {availableLanguages.length > 1 && (
            <Select
              value={selectedLang}
              onValueChange={(v) => setSelectedLang(v)}
            >
              <SelectTrigger className="flex-shrink-0 min-w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableLanguages.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="grid grid-cols-12 gap-8">
          <div
            className={`col-span-12 ${hasSidebar ? "lg:col-span-9" : "lg:col-span-12"}`}
          >
            <div className="px-2 sm:px-6 pt-4">{children}</div>
          </div>

          {hasSidebar && (
            <div className="col-span-12 lg:col-span-3 hidden lg:block">
              {sidebar}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

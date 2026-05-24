import type { BookDTO } from "@rezics/contract";
import * as m from "@rezics/i18n/messages";
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
import { MainContentContainer } from "@/core/components/container/MainContentContainer";
import { useBookLanguage } from "../hooks/useBookLanguage";

const TAB_ROUTES = [
  "info",
  "review",
  "content",
  "discussion",
  "history",
] as const;
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
      <MainContentContainer width="wide" className="mt-4 mb-12">
        <div className="flex flex-row items-center gap-4 mb-4">
          <div className="flex-1 min-w-0 max-w-full overflow-hidden">
            <Tabs
              value={activeTab}
              onValueChange={handleTabChange}
              className="max-w-full"
            >
              <TabsList
                variant="line"
                className="w-full max-w-full justify-start overflow-x-auto overscroll-x-contain scroll-smooth snap-x snap-mandatory sm:w-fit sm:overflow-visible"
              >
                <TabsTrigger value="info" className="flex-none snap-start">
                  {m.page_book_tabs_overview()}
                </TabsTrigger>
                <TabsTrigger value="review" className="flex-none snap-start">
                  {m.page_book_tabs_review_shelf()}
                </TabsTrigger>
                <TabsTrigger value="content" className="flex-none snap-start">
                  {m.page_book_tabs_content()}
                </TabsTrigger>
                <TabsTrigger
                  value="discussion"
                  className="flex-none snap-start"
                >
                  {m.page_book_tabs_community()}
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-none snap-start">
                  History
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {availableLanguages.length > 1 && (
            <Select
              value={selectedLang}
              onValueChange={(v) => v && setSelectedLang(v)}
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
            <div className="pt-4">{children}</div>
          </div>

          {hasSidebar && (
            <div className="col-span-12 lg:col-span-3 hidden lg:block">
              {sidebar}
            </div>
          )}
        </div>
      </MainContentContainer>
    </div>
  );
};

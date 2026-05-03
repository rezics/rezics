import { Box, Grid, MenuItem, Stack, TextField } from "@mui/material";
import type { BookDTO } from "@rezics/contract";
import { Tabs, TabsList, TabsTrigger } from "@rezics/ui/shadcn";
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
    <Box id="book-detail">
      <Box maxWidth="xl" className="mt-4 mb-12 mx-auto">
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
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
          </Box>

          {availableLanguages.length > 1 && (
            <TextField
              select
              size="small"
              variant="standard"
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
              sx={{ flexShrink: 0, minWidth: 100 }}
              slotProps={{
                input: { disableUnderline: true },
              }}
            >
              {availableLanguages.map((lang) => (
                <MenuItem key={lang} value={lang}>
                  {lang}
                </MenuItem>
              ))}
            </TextField>
          )}
        </Stack>

        <Grid container spacing={4}>
          <Grid size={{ xs: 12, lg: hasSidebar ? 9 : 12 }}>
            <Box sx={{ px: { xs: 1, sm: 3 }, pt: 2 }}>{children}</Box>
          </Grid>

          {hasSidebar && (
            <Grid
              size={{ xs: 12, lg: 3 }}
              sx={{ display: { xs: "none", lg: "block" } }}
            >
              {sidebar}
            </Grid>
          )}
        </Grid>
      </Box>
    </Box>
  );
};

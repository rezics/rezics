import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import {
  Chip,
  Divider,
  List,
  ListItemButton,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { useTheme } from "@mui/material/styles";
import { MUILink } from "@rezics/ui/primitive/link/MUILink.tsx";
import type { TFunction } from "i18next";
import type React from "react";
import { useTranslation } from "react-i18next";
import {
  AnnouncementFeedSection,
  type PinboardAnnouncementItem,
} from "@/pinboard";

function formatRelativeWithT(t: TFunction, dateIso: string): string {
  const ms = Date.now() - new Date(dateIso).getTime();
  const h = Math.floor(ms / 36e5);
  if (h < 1) return t("page.home.noticeboard.time.just_now");
  if (h < 24)
    return t("page.home.noticeboard.time.hours_ago_other", { count: h });
  const d = Math.floor(h / 24);
  if (d < 7)
    return t("page.home.noticeboard.time.days_ago_other", { count: d });
  const w = Math.floor(d / 7);
  return t("page.home.noticeboard.time.weeks_ago_other", { count: w });
}

function NoticeBoardHeader({
  theme,
  className,
  t,
}: {
  theme: Theme;
  className?: string;
  t: TFunction;
}) {
  return (
    <div className={className}>
      <div className="p-2 flex items-center justify-between">
        <Stack direction="row" spacing={1.5} alignItems="center">
          <div
            className="w-12 h-12 inline-flex items-center justify-center rounded-[10px] shadow-sm"
            style={{
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
            }}
          >
            <NotificationsRoundedIcon className="w-6 h-6" />
          </div>
          <div>
            <Typography variant="caption" color="text.secondary">
              {t("page.home.noticeboard.caption")}
            </Typography>
            <Typography variant="subtitle1" fontWeight={600}>
              {t("page.home.noticeboard.title")}
            </Typography>
          </div>
        </Stack>
        <MUILink to="/notice" underline="hover" color="primary" variant="body2">
          {t("common.view_all")}
        </MUILink>
      </div>

      <Divider />
    </div>
  );
}

function NoticeBoardItem({
  item,
  theme,
  t,
}: {
  item: PinboardAnnouncementItem;
  theme: Theme;
  t: TFunction;
}) {
  return (
    <div className="mb-1">
      <ListItemButton
        component="a"
        href={item.link ?? "#"}
        sx={{
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.background.paper,
          transition: theme.transitions.create(
            ["background-color", "border-color"],
            {
              duration: theme.transitions.duration.shortest,
            },
          ),
          "&:hover": {
            borderColor: theme.palette.primary.light,
            bgcolor:
              theme.palette.mode === "light"
                ? ((theme.palette.primary as any)[50] ??
                  "rgba(25,118,210,0.06)")
                : "rgba(25,118,210,0.12)",
          },
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="flex-start"
          sx={{ width: "100%" }}
        >
          <Chip
            label={item.pin ? t("common.pinned") : t("common.new")}
            color={item.pin ? "warning" : "default"}
            size="small"
            variant={item.pin ? "filled" : "outlined"}
            sx={{ mt: 0.25 }}
          />
          <div className="min-w-0 flex-1">
            <Typography
              variant="body2"
              fontWeight={600}
              noWrap
              sx={{
                color: "text.primary",
                flexShrink: 1,
                minWidth: 0,
              }}
            >
              {item.title}
            </Typography>
            {item.content && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mt: 0.5,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {item.content}
              </Typography>
            )}
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ mt: 0.5, display: "block" }}
            >
              {formatRelativeWithT(t, item.date)}
            </Typography>
          </div>
          <Typography
            variant="body2"
            color="text.disabled"
            sx={{
              ml: 0.5,
              opacity: 0,
              transition: theme.transitions.create("opacity", {
                duration: theme.transitions.duration.shortest,
              }),
              ".MuiListItemButton-root:hover &": { opacity: 1 },
            }}
            className={item.link ? "visible" : "invisible"}
          >
            →
          </Typography>
        </Stack>
      </ListItemButton>
    </div>
  );
}

export const NoticeBoard: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <div className="w-full h-full flex flex-col">
      <NoticeBoardHeader
        theme={theme}
        className="sticky top-0 z-10 rounded-lg"
        t={t}
      />

      <div className="flex-1 overflow-y-auto space-y-3 mt-3 p-2">
        <AnnouncementFeedSection
          loadingFallback={
            <Stack spacing={1.2}>
              <Skeleton variant="rounded" height={18} />
              <Skeleton variant="rounded" height={18} />
              <Skeleton variant="rounded" height={18} />
              <Skeleton variant="rounded" height={18} />
            </Stack>
          }
        >
          {(items) => {
            if (items.length === 0) {
              return (
                <Typography variant="body2" color="text.secondary">
                  {t("page.home.noticeboard.empty")}
                </Typography>
              );
            }
            return (
              <List
                dense
                disablePadding
                sx={{
                  maxHeight: "100%",
                  overflow: "auto",
                  pr: 0.5,
                  "& .MuiListItemButton-root": {
                    borderRadius: 1.5,
                  },
                }}
              >
                {items.map((item) => (
                  <NoticeBoardItem
                    key={item.id}
                    item={item}
                    theme={theme}
                    t={t}
                  />
                ))}
              </List>
            );
          }}
        </AnnouncementFeedSection>
      </div>
    </div>
  );
};

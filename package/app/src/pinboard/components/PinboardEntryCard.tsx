import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import PushPinRoundedIcon from "@mui/icons-material/PushPinRounded";
import {
  Box,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import type React from "react";
import { useTranslation } from "react-i18next";
import type { PinboardEntryDTO } from "../models/types";

export type PinboardEntryCardVariant = "compact" | "card" | "adminRow";

export interface PinboardEntryCardProps {
  entry: PinboardEntryDTO;
  variant?: PinboardEntryCardVariant;
  href?: string;
  onEdit?: (entry: PinboardEntryDTO) => void;
  onDelete?: (entry: PinboardEntryDTO) => void;
  /**
   * Rendered at the leading edge of the adminRow variant; intended for
   * dnd-kit drag handle wiring (listeners/attributes).
   */
  dragHandle?: React.ReactNode;
  /** Warning ribbon to mark this entry as stale (underlying unit gone). */
  stale?: boolean;
}

/**
 * Presentation-only card for a pinboard entry. The three variants share
 * fields but change layout density. Interaction (edit/delete) is
 * surfaced only on `adminRow`.
 */
export const PinboardEntryCard: React.FC<PinboardEntryCardProps> = ({
  entry,
  variant = "card",
  href,
  onEdit,
  onDelete,
  dragHandle,
  stale,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const title = entry.title ?? t("pinboard.entry.untitled");
  const summary = entry.summary ?? undefined;

  if (variant === "compact") {
    return (
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ minWidth: 0, flex: 1 }}
      >
        <PushPinRoundedIcon
          sx={{ fontSize: 14, color: theme.palette.warning.main }}
          aria-hidden="true"
        />
        <Typography
          variant="body2"
          sx={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minWidth: 0,
            flex: 1,
          }}
          component={href ? "a" : "span"}
          {...(href ? { href } : {})}
        >
          {title}
        </Typography>
      </Stack>
    );
  }

  if (variant === "adminRow") {
    return (
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        sx={{
          py: 1,
          px: 1.5,
          borderRadius: 1.5,
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: stale
            ? theme.palette.action.disabledBackground
            : theme.palette.background.paper,
          opacity: stale ? 0.75 : 1,
        }}
      >
        {dragHandle ?? (
          <DragIndicatorRoundedIcon
            sx={{ color: theme.palette.text.disabled }}
            aria-hidden="true"
          />
        )}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography
              variant="body2"
              fontWeight={600}
              noWrap
              sx={{ minWidth: 0 }}
            >
              {title}
            </Typography>
            {stale ? (
              <Chip
                size="small"
                color="warning"
                variant="outlined"
                label={t("pinboard.entry.stale")}
              />
            ) : null}
            <Chip
              size="small"
              variant="outlined"
              label={entry.language}
              aria-label={t("pinboard.entry.language", {
                lang: entry.language,
              })}
            />
          </Stack>
          {summary ? (
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ display: "block" }}
            >
              {summary}
            </Typography>
          ) : null}
        </Box>
        <Stack direction="row" spacing={0.5}>
          {onEdit ? (
            <Tooltip title={t("common.edit")}>
              <IconButton
                size="small"
                onClick={() => onEdit(entry)}
                aria-label={t("common.edit")}
              >
                <EditRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
          {onDelete ? (
            <Tooltip title={t("common.delete")}>
              <IconButton
                size="small"
                color="error"
                onClick={() => onDelete(entry)}
                aria-label={t("common.delete")}
              >
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
        </Stack>
      </Stack>
    );
  }

  // Default "card" variant — used by realm feed pinned section.
  return (
    <Box
      component={href ? "a" : "div"}
      {...(href ? { href } : {})}
      sx={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        p: 2,
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: theme.palette.background.paper,
        transition: theme.transitions.create(["border-color", "background-color"]),
        "&:hover": href
          ? { borderColor: theme.palette.primary.light }
          : undefined,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <PushPinRoundedIcon
          sx={{ fontSize: 16, color: theme.palette.warning.main }}
          aria-hidden="true"
        />
        <Typography variant="subtitle2" fontWeight={600} noWrap>
          {title}
        </Typography>
      </Stack>
      {summary ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {summary}
        </Typography>
      ) : null}
    </Box>
  );
};

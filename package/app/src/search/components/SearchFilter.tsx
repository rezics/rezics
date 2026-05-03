import { Button, Menu, MenuItem, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { SortControlsProps } from "@rezics/ui/composite/pagination/Pagination.tsx";
import React from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown as ArrowDownward, ChevronDown as ArrowDropDownIcon, ArrowUp as ArrowUpward } from "lucide-react";

export type BookLibSortKey =
  | "relevance"
  | "time"
  | "favorites"
  | "wordCount"
  | "monthVotes"
  | "recommend";

const LABEL_KEYS: Partial<Record<BookLibSortKey, string>> = {
  relevance: "search.filter.relevance",
  time: "search.filter.time",
  favorites: "search.filter.favorites",
  wordCount: "search.filter.word_count",
  monthVotes: "search.filter.month_votes",
};

export type BookSearchFilterProps = SortControlsProps;

export const BookSearchFilter: React.FC<BookSearchFilterProps> = ({
  sortType,
  sortOrder,
  onSortChange,
}) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const theme = useTheme();

  const handleClick = (key: string) => (e: React.MouseEvent) => {
    if (key === "recommend") {
      const el = e.currentTarget as HTMLElement;
      setAnchorEl(el);
      return;
    }
  };

  const handleSecondaryMenuSelect = (key: string) => () => {
    console.log(key);
    setAnchorEl(null);
  };

  return (
    <div className="flex justify-between">
      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        className="book-search-filter mb-8"
      >
        {(Object.keys(LABEL_KEYS) as BookLibSortKey[]).map((key) => {
          const active = key === sortType;
          return (
            <Button
              key={key}
              onClick={() => onSortChange({ type: key })}
              sx={{
                backgroundColor: active ? theme.palette.secondary.main : "",
              }}
            >
              <Typography variant="body2">
                {t(LABEL_KEYS[key]! as any)}
              </Typography>
            </Button>
          );
        })}
        <Button
          onClick={handleClick("recommend")}
          endIcon={<ArrowDropDownIcon fontSize="small" />}
        >
          <Typography variant="body2">
            {t("search.filter.recommendation")}
          </Typography>
        </Button>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
        >
          <MenuItem onClick={handleSecondaryMenuSelect("weekVotes")}>
            {t("search.filter.week_votes")}
          </MenuItem>
          <MenuItem onClick={handleSecondaryMenuSelect("monthVotes")}>
            {t("search.filter.month_votes")}
          </MenuItem>
          <MenuItem onClick={handleSecondaryMenuSelect("totalVotes")}>
            {t("search.filter.total_votes")}
          </MenuItem>
        </Menu>
      </Stack>
      <div>
        <Button
          value="desc"
          onClick={() => onSortChange({ order: "desc" })}
          size="small"
          sx={{
            backgroundColor:
              sortOrder === "desc" ? theme.palette.secondary.main : "",
            textTransform: "none",
          }}
        >
          <ArrowDownward />
          &nbsp; {t("search.filter.desc")}
        </Button>
        <Button
          value="asc"
          onClick={() => onSortChange({ order: "asc" })}
          className="!ml-2"
          size="small"
          sx={{
            backgroundColor:
              sortOrder === "asc" ? theme.palette.secondary.main : "",
            textTransform: "none",
          }}
        >
          <ArrowUpward />
          &nbsp; {t("search.filter.asc")}
        </Button>
      </div>
    </div>
  );
};

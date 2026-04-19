import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Avatar, IconButton, Paper, Tooltip, Typography } from "@mui/material";
import type { ExcerptSource } from "@rezics/contract";
import { SafeLink } from "@rezics/ui/link/SafeLink.tsx";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { MUILink } from "@rezics/ui/primitive/link/MUILink.tsx";

import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import { Collapsible } from "@rezics/ui/primitive/typography/collapsible/Collapsible.tsx";
import type React from "react";
import { useTranslation } from "react-i18next";

export type SingleExcerptShowProps = {
  author: {
    unitId: string;
    name: string;
    avatar: string;
  };
  content: string;
  stats: {
    replies: number;
    likes: number;
    date: string;
  };
  source: ExcerptSource | string;
  originalLink: string;
};

export const SingleExcerptShow: React.FC<SingleExcerptShowProps> = ({
  author,
  content,
  stats,
  source,
  originalLink,
}) => {
  const { t } = useTranslation();
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        position: "relative",
        "& .MuiPaper-root": {
          borderColor: "divider",
        },
      }}
    >
      <Tooltip title="打开全文">
        <IconButton
          component={MUILink}
          to={originalLink}
          size="small"
          sx={{ position: "absolute", top: 8, right: 8 }}
          aria-label="打开全文"
        >
          <OpenInNewIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <div className="flex items-center mb-2">
        <Tooltip title={"打开用户界面"} placement="top-start">
          <Link
            to="/user/$unitId"
            params={{ unitId: author.unitId }}
            className="flex items-center"
          >
            <Avatar
              src={author.avatar}
              sx={{ width: 20, height: 20, mr: 1 }}
              variant="rounded"
            />
            <Typography variant="subtitle2" fontWeight="bold">
              {author.name}
            </Typography>
          </Link>
        </Tooltip>
      </div>

      <div className="flex items-start">
        <FormatQuoteIcon
          sx={{
            fontSize: 30,
            color: "text.secondary",
            mr: 1,
            mt: 0.5,
          }}
        />
        <div className="flex-1">
          <Typography
            component="div"
            variant="body2"
            color="text.primary"
            sx={{ lineHeight: 1.6 }}
          >
            <Collapsible
              maxLines={4}
              showMoreLabel={t("common.expand")}
              showLessLabel={t("common.collapse")}
            >
              <MarkdownContent content={content} />
            </Collapsible>
          </Typography>

          <div className="flex items-center justify-between mt-3">
            <div className="flex gap-1">
              {/* <Typography variant="caption" color="text.secondary">
                {stats.replies} {t('common.reply')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {stats.likes} {t('accessibility.favorite')}
              </Typography> */}
              <Typography
                variant="caption"
                color="text.secondary"
                className="hidden md:block"
              >
                {stats.date}
              </Typography>
            </div>
            <Typography variant="caption" color="text.disabled">
              —— <SingleExcerptSource source={source} />
            </Typography>
          </div>
        </div>
      </div>
    </Paper>
  );
};

function SingleExcerptSource({ source }: { source: ExcerptSource | string }) {
  if (!source) return null;
  if (typeof source === "string") return <>{source}</>;
  const href = source.mode === "unit" ? `/unit/${source.unitId}` : source.url;
  return (
    <SafeLink href={href} className="underline">
      {source.title}
    </SafeLink>
  );
}

export type SingleExcerptContainerProps = any;
export const SingleExcerptContainer: React.FC<
  SingleExcerptContainerProps
> = () => {
  const res = {} as SingleExcerptShowProps;
  return <SingleExcerptShow {...res} />;
};

import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import { Box, Typography } from "@mui/material";
import type { ExcerptSource, UnitDTO } from "@rezics/contract";
import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import { SafeLink } from "@rezics/ui/link/SafeLink.tsx";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import type React from "react";

interface ExcerptDetailProps {
  excerpt: UnitDTO;
}

export const ExcerptDetail: React.FC<ExcerptDetailProps> = ({ excerpt }) => {
  const description = excerpt.translations?.[0]?.description ?? "";
  const source = (excerpt.extra as Record<string, unknown> | null)?.source as
    | ExcerptSource
    | string
    | undefined;
  const dateStr = excerpt.createdAt
    ? new Date(String(excerpt.createdAt)).toLocaleDateString()
    : "";

  return (
    <Box className="flex flex-col gap-4">
      {excerpt.user && (
        <Box className="flex items-center gap-3">
          <Link
            to="/user/$unitId"
            params={{ unitId: excerpt.user.unitId ?? "" }}
            className="flex items-center gap-3"
          >
            <LazyLoadImage
              src={excerpt.user.avatar ?? ""}
              alt={excerpt.user.name ?? ""}
              className="w-10 h-10 rounded-full shadow"
            />
            <Typography variant="body2" fontWeight={600}>
              {excerpt.user.name ?? ""}
            </Typography>
          </Link>
          {dateStr && (
            <Typography variant="caption" color="text.secondary">
              {dateStr}
            </Typography>
          )}
        </Box>
      )}

      <Box className="flex items-start gap-2">
        <FormatQuoteIcon
          sx={{ fontSize: 30, color: "text.secondary", mt: 0.5 }}
        />
        <Box className="flex-1">
          <MarkdownContent content={description} />
        </Box>
      </Box>

      <ExcerptSourceLine source={source} />
    </Box>
  );
};

function ExcerptSourceLine({ source }: { source?: ExcerptSource | string }) {
  if (!source) return null;
  if (typeof source === "string") {
    return (
      <Typography variant="caption" color="text.disabled">
        —— {source}
      </Typography>
    );
  }
  const href = source.mode === "unit" ? `/unit/${source.unitId}` : source.url;
  return (
    <Typography variant="caption" color="text.disabled">
      ——{" "}
      <SafeLink href={href} className="underline">
        {source.title}
      </SafeLink>
    </Typography>
  );
}

import { Typography } from "@mui/material";
import type React from "react";
import { KeywordInput } from "@/search/components/primitive";
import { useSearchQuery } from "@/search/hooks/useSearchQuery";
import type { ZoneTemplateProps } from "./types";

/**
 * Book-oriented zone homepage template.
 * Will reuse sections from book-library feature when
 * zone-scoped content queries are available.
 */
export const BookZoneTemplate: React.FC<ZoneTemplateProps> = ({
  zone,
  onSearch,
}) => {
  const search = useSearchQuery({});
  const keywordBind = search.bind("keyword");
  const bgImage = (zone.styling as Record<string, unknown> | null)?.bgImage as
    | string
    | undefined;
  const accentColor = (zone.styling as Record<string, unknown> | null)
    ?.accentColor as string | undefined;

  return (
    <div>
      {/* Banner */}
      <div
        className="relative py-24 px-8 mb-8 rounded-lg"
        style={{
          backgroundImage: bgImage ? `url(${bgImage})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: accentColor ?? "var(--rezics-color-brand-fill)",
        }}
      >
        <div className="relative z-10">
          <Typography variant="h4" className="font-bold text-white mb-2">
            {zone.name}
          </Typography>
          {zone.description && (
            <Typography variant="body1" className="text-white/80">
              {zone.description}
            </Typography>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="mb-12">
        <KeywordInput
          value={keywordBind.value ?? ""}
          onChange={(v) => keywordBind.onChange(v)}
          onSubmit={() => onSearch?.(search.query.keyword ?? "")}
          placeholder={`Search books in ${zone.name}...`}
        />
      </div>

      {/* Book sections */}
      <div>
        <Typography variant="h6" className="mb-4">
          Books
        </Typography>
        {/* MOCK: book listing sections with zone.filters pre-applied will be wired here */}
        <Typography color="text.secondary">
          Book content for this zone will appear here.
        </Typography>
      </div>
    </div>
  );
};

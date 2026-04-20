import { Typography } from "@mui/material";
import type React from "react";
import { KeywordInput } from "@/search/components/primitive";
import { useSearchQuery } from "@/search/hooks/useSearchQuery";
import type { ZoneTemplateProps } from "./types";

/**
 * Default zone homepage template.
 * Generic layout: banner + search + content area.
 */
export const DefaultZoneTemplate: React.FC<ZoneTemplateProps> = ({
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
        className="relative py-12 px-6 mb-6 rounded-lg"
        style={{
          backgroundImage: bgImage ? `url(${bgImage})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: accentColor ?? "var(--mui-palette-primary-main)",
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
      <div className="mb-8">
        <KeywordInput
          value={keywordBind.value ?? ""}
          onChange={(v) => keywordBind.onChange(v)}
          onSubmit={() => onSearch?.(search.query.keyword ?? "")}
          placeholder={`Search in ${zone.name}...`}
        />
      </div>

      {/* Content area — populated by child routes or sections */}
      <div>
        <Typography variant="h6" className="mb-4">
          Latest Content
        </Typography>
        {/* MOCK: content sections will be wired when zone-specific content queries exist */}
        <Typography color="text.secondary">
          Content for this zone will appear here.
        </Typography>
      </div>
    </div>
  );
};

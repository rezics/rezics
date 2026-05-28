import { useTranslation } from "@rezics/i18n/react";
import type React from "react";
import { KeywordInput, useSearchQuery } from "@/search";
import type { ZoneTemplateProps } from "./types";

/**
 * Default zone homepage template.
 * Generic layout: banner + search + content area.
 */
export const DefaultZoneTemplate: React.FC<ZoneTemplateProps> = ({
  zone,
  onSearch,
}) => {
  const { t } = useTranslation(["search"]);
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
          backgroundColor: accentColor ?? "var(--colors-brand-fill)",
        }}
      >
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-white mb-2">{zone.name}</h1>
          {zone.description && (
            <p className="text-base text-white/80">{zone.description}</p>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="mb-12">
        <KeywordInput
          value={keywordBind.value ?? ""}
          onChange={(v) => keywordBind.onChange(v)}
          onSubmit={() => onSearch?.(search.query.keyword ?? "")}
          placeholder={t("search:zone_search_placeholder", { name: zone.name })}
        />
      </div>

      {/* Content area — populated by child routes or sections */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          {t("search:zone_latest_content")}
        </h2>
        {/* MOCK: content sections will be wired when zone-specific content queries exist */}
        <p className="text-text-secondary">{t("search:zone_content_placeholder")}</p>
      </div>
    </div>
  );
};

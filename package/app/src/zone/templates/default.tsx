import type React from "react";
import { KeywordInput } from "@/search/components/primitive";
import { useSearchQuery } from "@/search/hooks/useSearchQuery";
import type { ZoneTemplateProps } from "./types";
import { useMessage } from "@rezics/i18n/react";
import {
  zone_content_placeholder,
  zone_latest_content,
  zone_search_placeholder,
} from "@rezics/i18n/messages";
const m = {
  zone_content_placeholder,
  zone_latest_content,
  zone_search_placeholder,
};

const i18nMessages = {
  zone_content_placeholder,
  zone_latest_content,
  zone_search_placeholder,
};

/**
 * Default zone homepage template.
 * Generic layout: banner + search + content area.
 */
export const DefaultZoneTemplate: React.FC<ZoneTemplateProps> = ({
  zone,
  onSearch,
}) => {
  const m = useMessage(i18nMessages);
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
          placeholder={m.zone_search_placeholder({ name: zone.name })}
        />
      </div>

      {/* Content area — populated by child routes or sections */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          {m.zone_latest_content()}
        </h2>
        {/* MOCK: content sections will be wired when zone-specific content queries exist */}
        <p className="text-text-secondary">{m.zone_content_placeholder()}</p>
      </div>
    </div>
  );
};

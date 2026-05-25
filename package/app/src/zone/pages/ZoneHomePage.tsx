import {
  zone_loading,
  zone_not_found,
  zone_not_found_description,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useZone } from "../hooks/useZone";
import { BookZoneTemplate } from "../templates/book";
import { DefaultZoneTemplate } from "../templates/default";

const i18nMessages = {
  zone_loading,
  zone_not_found,
  zone_not_found_description,
};

const templates: Record<string, React.FC<any>> = {
  default: DefaultZoneTemplate,
  book: BookZoneTemplate,
};

export type ZoneHomePageProps = {
  slug: string;
};

export const ZoneHomePage: React.FC<ZoneHomePageProps> = ({ slug }) => {
  const m = useMessage(i18nMessages);
  const { zone, isLoading, error } = useZone(slug);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <p className="text-text-secondary">{m.zone_loading()}</p>
      </div>
    );
  }

  if (error || !zone) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl font-semibold mb-2">{m.zone_not_found()}</h2>
        <p className="text-text-secondary">{m.zone_not_found_description()}</p>
      </div>
    );
  }

  const Template = templates[zone.template] ?? templates.default!;

  const handleSearch = (keyword: string) => {
    navigate({
      to: "/z/$slug/search",
      params: { slug },
      search: { keyword },
    });
  };

  return (
    <div className="max-w-8xl mx-auto px-4 py-8">
      <Template zone={zone} onSearch={handleSearch} />
    </div>
  );
};

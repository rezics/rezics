import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useZone } from "../hooks/useZone";
import { BookZoneTemplate } from "../templates/book";
import { DefaultZoneTemplate } from "../templates/default";

const templates: Record<string, React.FC<any>> = {
  default: DefaultZoneTemplate,
  book: BookZoneTemplate,
};

export type ZoneHomePageProps = {
  slug: string;
};

export const ZoneHomePage: React.FC<ZoneHomePageProps> = ({ slug }) => {
  const { zone, isLoading, error } = useZone(slug);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <p className="text-rezics-color-fg-muted">Loading zone...</p>
      </div>
    );
  }

  if (error || !zone) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl font-semibold mb-2">Zone not found</h2>
        <p className="text-rezics-color-fg-muted">
          The zone you're looking for doesn't exist or is no longer available.
        </p>
      </div>
    );
  }

  const Template = templates[zone.template] ?? templates.default!;

  const handleSearch = (keyword: string) => {
    navigate({
      to: "/zone/$slug/search",
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

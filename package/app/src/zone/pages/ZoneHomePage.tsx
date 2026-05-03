import { Typography } from "@mui/material";
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
        <Typography color="text.secondary">Loading zone...</Typography>
      </div>
    );
  }

  if (error || !zone) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <Typography variant="h5" className="mb-2">
          Zone not found
        </Typography>
        <Typography color="text.secondary">
          The zone you're looking for doesn't exist or is no longer available.
        </Typography>
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

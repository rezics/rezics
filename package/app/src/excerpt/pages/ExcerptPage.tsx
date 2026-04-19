import type React from "react";
import { excerptRoute } from "@/router";
import { ExcerptDetailSection } from "../sections/ExcerptDetailSection";

export const ExcerptPage: React.FC = () => {
  const { unitId } = excerptRoute.useParams();
  return (
    <div
      className="w-full max-w-4xl mt-[60px] mx-auto"
      data-testid="booklist-page"
    >
      <ExcerptDetailSection unitId={unitId ?? ""} />
    </div>
  );
};

export default ExcerptPage;

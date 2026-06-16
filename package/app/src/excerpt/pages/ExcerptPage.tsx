import type React from "react";
import { Route as excerptRoute } from "@/routes/_mainLayout/excerpt/$unitId";
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

import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import type React from "react";
import { useMessage } from "@rezics/i18n/react";
import { page_home_sections_partner_brands } from "@rezics/i18n/messages";
const i18nMessages = {
  page_home_sections_partner_brands,
};

const defaultBrands = [
  "https://dummyimage.com/100x40/cccccc/000&text=Brand+A",
  "https://dummyimage.com/100x40/cccccc/000&text=Brand+B",
  "https://dummyimage.com/100x40/cccccc/000&text=Brand+C",
  "https://dummyimage.com/100x40/cccccc/000&text=Brand+D",
  "https://dummyimage.com/100x40/cccccc/000&text=Brand+E",
];

export type HomePartnerBrandsProps = {
  logos?: string[];
  title?: string;
};

export const HomePartnerBrands: React.FC<HomePartnerBrandsProps> = ({
  logos = defaultBrands,
  title,
}) => {
  const m = useMessage(i18nMessages);
  const resolvedTitle = title ?? m.page_home_sections_partner_brands();
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold">{resolvedTitle}</span>
      </div>
      <div className="flex flex-wrap gap-8 items-center">
        {logos.map((src, i) => (
          <LazyLoadImage
            // biome-ignore lint/suspicious/noArrayIndexKey: static list
            key={i}
            src={src}
            alt={`brand-${i}`}
            className="h-16 object-contain"
          />
        ))}
      </div>
    </div>
  );
};

export default HomePartnerBrands;

import type { RealmBannerExtra } from "@rezics/contract";
import type React from "react";

export interface BannerSectionProps {
  banner?: RealmBannerExtra | null;
}

export const BannerSection: React.FC<BannerSectionProps> = ({ banner }) => {
  if (!banner?.url) return null;

  return (
    <section className="overflow-hidden rounded-md bg-surface-subtle">
      <img
        src={banner.url}
        alt=""
        className="h-48 w-full object-cover md:h-64"
      />
    </section>
  );
};

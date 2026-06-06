import type { WikiZoneHomepageData, ZoneDTO } from "@rezics/contract";
import type { ReactNode } from "react";

export type ZoneTemplateProps = {
  zone: ZoneDTO;
  homepageData?: WikiZoneHomepageData | null;
  homepageLoading?: boolean;
  onSearch?: (keyword: string) => void;
  children?: ReactNode;
};

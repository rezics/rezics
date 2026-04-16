import type { ZoneDTO } from "@rezics/contract";
import type { ReactNode } from "react";

export type ZoneTemplateProps = {
  zone: ZoneDTO;
  onSearch?: (keyword: string) => void;
  children?: ReactNode;
};

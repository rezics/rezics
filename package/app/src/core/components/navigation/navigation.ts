import type React from "react";

export type NavigationIcon = React.ElementType<{
  className?: string;
  size?: string | number;
  color?: string;
}>;

export type NavigationItem =
  | {
      kind: "item";
      segment: string;
      title: string;
      icon?: NavigationIcon;
      onlyMobile?: boolean;
      activeMatch?: "exact" | "prefix";
      isActive?: (pathname: string) => boolean;
      children?: NavigationItem[];
    }
  | { kind: "divider" };

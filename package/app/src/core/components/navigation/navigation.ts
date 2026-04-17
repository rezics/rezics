// navigation.ts（示例：把 icon 从 ReactElement 改成组件类型）
import type { SvgIconProps } from "@mui/material/SvgIcon";
import type React from "react";

export type NavigationIcon = React.ElementType<SvgIconProps>;

export type NavigationItem =
  | {
      kind: "item";
      segment: string;
      title: string;
      icon?: NavigationIcon;
      onlyMobile?: boolean;
      children?: NavigationItem[];
    }
  | { kind: "divider" };

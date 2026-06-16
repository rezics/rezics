import React from "react";

/**
 * TODO 之后维护自己的 icon Lib
 * 自己的图标库可以手动分类导出，比如 novel_tag 类，包含几个图标，之后DynamicIcon 根据 name 动态导入对应的图标集
 */

export type IconKey = string;

interface DynamicIconProps {
  name: IconKey;
  width?: number;
  height?: number;
  className?: string;
}

let iconsPromise: Promise<any> | null = null;

export function DynamicIcon({
  name,
  width = 24,
  height = 24,
  className,
}: DynamicIconProps) {
  const [Icons, setIcons] = React.useState<any>(null);

  React.useEffect(() => {
    loadIcons().then(setIcons);
  }, []);

  if (!Icons) return null;

  const IconComponent = Icons[name];
  if (!IconComponent) return null;

  return <IconComponent width={width} height={height} className={className} />;
}

async function loadIcons() {
  if (!iconsPromise) {
    iconsPromise = import("@react-symbols/icons");
  }
  return iconsPromise;
}

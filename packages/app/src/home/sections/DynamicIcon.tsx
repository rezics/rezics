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
    let cancelled = false;
    loadIcons()
      .then((icons) => {
        if (!cancelled) setIcons(icons);
      })
      .catch((error) => {
        // Log import failures in development; render nothing.
        // 开发环境下记录导入失败；不渲染任何内容。
        if (import.meta.env.DEV) {
          console.error("[DynamicIcon] Failed to load icon library:", error);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Icons) return null;

  const IconComponent = Icons[name];
  if (!IconComponent) return null;

  return <IconComponent width={width} height={height} className={className} />;
}

async function loadIcons() {
  if (!iconsPromise) {
    iconsPromise = import("@react-symbols/icons").catch((error) => {
      // Reset cache so a subsequent mount can retry the import.
      // 重置缓存，以便后续挂载可以重试导入。
      iconsPromise = null;
      throw error;
    });
  }
  return iconsPromise;
}

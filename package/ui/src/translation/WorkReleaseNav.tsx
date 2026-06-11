import { useTranslation } from "@rezics/i18n/react";
import type React from "react";
import { Badge } from "#/shadcn/badge";

export interface WorkReleaseNavRelease {
  unitId: string;
  /**
   * Resolved title for the current locale; caller chooses fallback.
   * 当前语言环境下解析得到的标题；兜底由调用方决定。
   */
  title?: string;
}

interface WorkReleaseNavProps {
  releases: WorkReleaseNavRelease[];
  currentUnitId: string;
  /**
   * Heading shown above the chip row. Caller localises.
   * 显示在 chip 行上方的标题。由调用方做本地化。
   */
  heading?: string;
  /**
   * Chip label fallback when a release has no resolved title.
   * 当某个 release 没有解析出标题时，chip 标签的兜底文案。
   */
  emptyLabel?: string;
  /**
   * Renders the link wrapping each chip. The caller owns the routing target
   * so that typed-route tables stay inside the consuming app package.
   * 渲染包裹每个 chip 的链接。由调用方负责路由目标，从而让类型化路由表保留在
   * 消费方的 app 包内。
   */
  renderLink: (
    release: WorkReleaseNavRelease,
    children: React.ReactNode,
  ) => React.ReactNode;
}

/**
 * Side-rail showing other releases of the same Work. The component is purely
 * presentational; data fetching and routing are owned by the caller.
 * 展示同一 Work 其他 release 的侧栏。该组件纯展示；数据获取与路由由调用方负责。
 */
export const WorkReleaseNav: React.FC<WorkReleaseNavProps> = ({
  releases,
  currentUnitId,
  heading,
  emptyLabel,
  renderLink,
}) => {
  const { t } = useTranslation("book");
  const effectiveHeading = heading ?? t("otherEditions");
  const effectiveEmptyLabel = emptyLabel ?? t("editionFallback");
  const others = releases.filter((r) => r.unitId !== currentUnitId);
  if (others.length === 0) return null;

  return (
    <div>
      <p className="text-sm font-semibold mb-1">{effectiveHeading}</p>
      <div className="flex flex-row flex-wrap gap-2">
        {others.map((release) =>
          renderLink(
            release,
            <Badge
              key={release.unitId}
              variant="outline"
              className="cursor-pointer"
            >
              {release.title ?? effectiveEmptyLabel}
            </Badge>,
          ),
        )}
      </div>
    </div>
  );
};

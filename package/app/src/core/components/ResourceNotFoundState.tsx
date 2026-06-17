import { useTranslation } from "@rezics/i18n/react";
import { EmptyState } from "@rezics/ui";
import { FileQuestion } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/utils/css-util";

export type ResourceNotFoundStateVariant = "compact" | "inline" | "section";

export interface ResourceNotFoundStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  variant?: ResourceNotFoundStateVariant;
  className?: string;
}

/**
 * Local missing-resource state for component-owned auxiliary queries.
 * 组件级缺失资源提示。route 主体资源必须在 loader 中抛出 router notFound；
 * 这个组件只替换局部表面，不接管整页路由边界。
 *
 * Mobile <640px:
 * +----------------------+
 * |        icon          |
 * |  Missing title       |
 * |  description wraps   |
 * |  action (optional)   |
 * +----------------------+
 *
 * Tablet 640-1023px:
 * +--------------------------+
 * |          icon            |
 * |      Missing title       |
 * |   description centered   |
 * |        action            |
 * +--------------------------+
 *
 * Desktop 1024-1535px:
 * +------------------------------+
 * |            icon              |
 * |        Missing title         |
 * |     description centered     |
 * |          action              |
 * +------------------------------+
 *
 * Ultra-wide >=1536px:
 * +------------------------------+
 * |       same centered block    |
 * |       outer parent controls  |
 * |       maximum content width  |
 * +------------------------------+
 */
export function ResourceNotFoundState({
  title,
  description,
  action,
  variant = "inline",
  className,
}: ResourceNotFoundStateProps) {
  const { t } = useTranslation(["common"]);
  const sizeClass =
    variant === "compact"
      ? "px-3 py-4 sm:py-4"
      : variant === "section"
        ? "min-h-[16rem] px-4 py-16 sm:py-20"
        : "px-4 py-8 sm:py-10";

  return (
    <EmptyState
      title={title ?? t("common:resource_not_found_title")}
      description={description ?? t("common:resource_not_found_description")}
      icon={<FileQuestion className="h-8 w-8" aria-hidden="true" />}
      action={action}
      className={cn(sizeClass, className)}
    />
  );
}

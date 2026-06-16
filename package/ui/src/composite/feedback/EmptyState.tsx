import type { FC, ReactNode } from "react";

import { cn } from "../../shared/lib/utils";

export interface EmptyStateProps {
  title: string;
  description?: string;
  /**
   * A `lucide-react` (or `@tabler/icons-react`) icon node, or any custom React node.
   * 一个 `lucide-react`（或 `@tabler/icons-react`）图标节点，或任意自定义 React 节点。
   */
  icon?: ReactNode;
  /**
   * Optional action affordance — typically a shadcn `Button`.
   * 可选的操作控件——通常是一个 shadcn `Button`。
   */
  action?: ReactNode;
  className?: string;
}

export const EmptyState: FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-4 py-10 text-center sm:py-14",
        className,
      )}
    >
      {icon ? <div className="text-text-tertiary">{icon}</div> : null}
      <p className="text-base font-medium text-text-primary">{title}</p>
      {description ? (
        <p className="text-sm text-text-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
};

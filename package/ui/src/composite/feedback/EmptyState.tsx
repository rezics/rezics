import type { FC, ReactNode } from "react";

import { cn } from "../../shared/lib/utils";

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** A `lucide-react` (or `@tabler/icons-react`) icon node, or any custom React node. */
  icon?: ReactNode;
  /** Optional action affordance — typically a shadcn `Button`. */
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

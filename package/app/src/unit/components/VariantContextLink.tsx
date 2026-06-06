import type { VariantContextSummary } from "@rezics/contract";
import { Layers2 } from "lucide-react";
import { AppSafeLink } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";

interface VariantContextLinkProps {
  context: VariantContextSummary;
  className?: string;
}

export function VariantContextLink({
  context,
  className,
}: VariantContextLinkProps) {
  return (
    <AppSafeLink
      href={`/book/${context.unitId}`}
      title={context.title}
      aria-label={context.title}
      className={cn(
        "flex min-w-0 items-center gap-1 text-xs leading-dense text-text-secondary transition-colors hover:text-text-primary",
        className,
      )}
    >
      <Layers2 className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">{context.title}</span>
    </AppSafeLink>
  );
}

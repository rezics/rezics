import type { EntityKind } from "@rezics/contract";
import { entityKindLabel } from "@rezics/i18n";

interface EntityKindBadgeProps {
  kind?: EntityKind | null;
}

export function EntityKindBadge({ kind }: EntityKindBadgeProps) {
  if (!kind) return null;

  return (
    <span className="rounded-full border border-border-whisper bg-surface-subtle px-2 py-0.5 text-xs uppercase tracking-wide text-text-secondary">
      {entityKindLabel(kind)}
    </span>
  );
}

import type { EntityKind } from "@rezics/contract";
import { useTranslation } from "react-i18next";

interface EntityKindBadgeProps {
  kind?: EntityKind | null;
}

export function EntityKindBadge({ kind }: EntityKindBadgeProps) {
  const { t } = useTranslation();

  if (!kind) return null;

  return (
    <span className="rounded-full border border-border-whisper bg-surface-subtle px-2 py-0.5 text-xs uppercase tracking-wide text-text-secondary">
      {t(`entity.kind.${kind}`, kind)}
    </span>
  );
}

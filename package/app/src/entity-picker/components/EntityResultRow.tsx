import type { EntityDTO } from "@rezics/contract";
import { BadgeCheck } from "lucide-react";
import { getEntityPrimaryTitle } from "@/entity-detail/models/types";

interface EntityResultRowProps {
  entity: EntityDTO;
  onSelect: (unitId: string) => void;
}

export function EntityResultRow({ entity, onSelect }: EntityResultRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entity.unitId)}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-surface-subtle"
    >
      <span className="flex-1 truncate text-text-primary">
        {getEntityPrimaryTitle(entity)}
      </span>
      {entity.kind ? (
        <span className="rounded-full border border-border-whisper px-2 py-0.5 text-xs uppercase text-text-secondary">
          {entity.kind}
        </span>
      ) : null}
      {entity.verified ? (
        <BadgeCheck
          className="h-4 w-4 text-text-brand"
          aria-label="Verified entity"
        />
      ) : null}
    </button>
  );
}

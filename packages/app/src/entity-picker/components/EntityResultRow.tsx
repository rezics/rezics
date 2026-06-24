import type { EntityDTO } from "@rezics/contract";
import { EntityIdentityRow } from "@/entity";

interface EntityResultRowProps {
  entity: EntityDTO;
  onSelect: (unitId: string) => void;
}

export function EntityResultRow({ entity, onSelect }: EntityResultRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entity.unitId)}
      className="w-full"
    >
      <EntityIdentityRow entity={entity} interactive avatarSize="sm" />
    </button>
  );
}

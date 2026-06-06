import type { ShelfItemDTO } from "@rezics/api/shelf";
import { Badge } from "@rezics/ui/shadcn";

interface ShelfItemCardProps {
  unit: ShelfItemDTO;
}

export function ShelfItemCard({ unit }: ShelfItemCardProps) {
  const shortRef =
    unit.unitId.length > 12
      ? `${unit.unitId.slice(0, 8)}…${unit.unitId.slice(-4)}`
      : unit.unitId;

  return (
    <div className="flex flex-row items-center gap-2 px-2 py-1">
      <Badge variant="outline" className="text-xs">
        {unit.kind}
      </Badge>
      <span className="text-xs text-text-secondary whitespace-nowrap">
        {shortRef}
      </span>
    </div>
  );
}

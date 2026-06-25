import type { ShelfItemDTO } from "@rezics/contract/api/shelf/shelf";
import { shelfItemReference } from "@rezics/contract";
import { Badge } from "@rezics/ui/shadcn";

interface ShelfItemCardProps {
  unit: ShelfItemDTO;
}

export function ShelfItemCard({ unit }: ShelfItemCardProps) {
  const ref = shelfItemReference(unit);
  const shortRef =
    ref.length > 12 ? `${ref.slice(0, 8)}…${ref.slice(-4)}` : ref;

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

import type { ShelfItemDTO } from "@rezics/api/shelf";
import { Badge } from "@rezics/ui/shadcn";

interface ShelfItemCardProps {
  item: ShelfItemDTO;
}

export function ShelfItemCard({ item }: ShelfItemCardProps) {
  const shortRef =
    item.itemRef.length > 12
      ? `${item.itemRef.slice(0, 8)}…${item.itemRef.slice(-4)}`
      : item.itemRef;

  return (
    <div className="flex flex-row items-center gap-2 px-2 py-1">
      <Badge variant="outline" className="text-xs">
        {item.kind}
      </Badge>
      <span className="text-xs text-text-secondary whitespace-nowrap">
        {shortRef}
      </span>
    </div>
  );
}

import { useReactionHydration } from "@rezics/contract/api/reaction/useReactionHydration";
import type { ShelfDTO } from "@rezics/contract";
import type React from "react";
import { useMemo } from "react";
import { ShelfCard } from "./ShelfCard";

interface ShelfListProps {
  shelves: ShelfDTO[];
}

export const ShelfList: React.FC<ShelfListProps> = ({ shelves }) => {
  const targetIds = useMemo(
    () => shelves.map((s) => s.unitId).filter(Boolean) as string[],
    [shelves],
  );
  useReactionHydration(targetIds);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {shelves.map((shelf) => (
        <ShelfCard key={shelf.unitId} shelf={shelf} />
      ))}
    </div>
  );
};

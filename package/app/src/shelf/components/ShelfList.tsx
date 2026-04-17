import type { ShelfDTO } from "@rezics/contract";
import type React from "react";
import { ShelfCard } from "./ShelfCard";

interface ShelfListProps {
  shelves: ShelfDTO[];
}

export const ShelfList: React.FC<ShelfListProps> = ({ shelves }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {shelves.map((shelf) => (
        <ShelfCard key={shelf.unitId} shelf={shelf} />
      ))}
    </div>
  );
};

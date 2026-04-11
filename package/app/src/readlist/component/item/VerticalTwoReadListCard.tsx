import type { ShelfDTO } from "@rezics/contract";
// ReadlistDTO replaced by ShelfDTO in the new architecture
import type React from "react";
import ReadListCard from "./ReadListCard";

interface VerticalTwoReadListCardProps {
  readlist1: ShelfDTO;
  readlist2: ShelfDTO;
}

export const VerticalTwoReadListCard: React.FC<
  VerticalTwoReadListCardProps
> = ({ readlist1, readlist2 }) => {
  return (
    <div className="flex flex-col gap-4 mb-2">
      <ReadListCard readlist={readlist1} />
      <ReadListCard readlist={readlist2} />
    </div>
  );
};

export default VerticalTwoReadListCard;

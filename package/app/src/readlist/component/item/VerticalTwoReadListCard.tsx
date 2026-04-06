import type { ReadlistDTO } from "@rezics/contract";
import type React from "react";
import ReadListCard from "./ReadListCard";

interface VerticalTwoReadListCardProps {
  readlist1: ReadlistDTO;
  readlist2: ReadlistDTO;
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

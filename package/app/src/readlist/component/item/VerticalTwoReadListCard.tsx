import React from 'react';
import type {ReadlistDTO} from '@package/contract';
import ReadListCard from './ReadListCard';

interface VerticalTwoReadListCardProps {
  readlist1: ReadlistDTO;
  readlist2: ReadlistDTO;
}

export const VerticalTwoReadListCard: React.FC<VerticalTwoReadListCardProps> = ({
  readlist1,
  readlist2,
}) => {
  return (
    <div className="flex flex-col gap-4 mb-2">
      <ReadListCard readlist={readlist1} />
      <ReadListCard readlist={readlist2} />
    </div>
  );
};

export default VerticalTwoReadListCard;

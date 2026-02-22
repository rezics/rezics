import {Rating} from '@mui/material';
import React, {useEffect} from 'react';

export type ScoreFormEditProps = {
  defaultValue?: number;
  onScoreChange?: (score: number) => void;
  onChangeActive?: (activeScore: number) => void;
  max?: number;
  precision?: number;
};

export const ScoreFormEdit: React.FC<ScoreFormEditProps> = ({
  defaultValue,
  onScoreChange,
  onChangeActive,
  max,
  precision,
}) => {
  let initScore;
  useEffect(() => {
    initScore = defaultValue != null ? Number(defaultValue) : 0;
  }, [defaultValue]);
  return (
    <div>
      <Rating
        name="score-rating-10"
        size="large"
        defaultValue={initScore}
        precision={precision ?? 0.5}
        max={max ?? 10}
        onChange={(event, value) => onScoreChange?.(value ?? 0)}
        onChangeActive={(event, value) => onChangeActive?.(value ?? 0)}
        className="inline-block align-middle items-center"
      />
    </div>
  );
};

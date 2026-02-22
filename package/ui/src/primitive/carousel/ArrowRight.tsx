import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import {ArrowButton} from './ArrowButton';
import React from 'react';

type ArrowRightProps = Omit<React.ComponentProps<typeof ArrowButton>, 'icon'>;

export const ArrowRight: React.FC<ArrowRightProps> = ({className}) => {
  return <ArrowButton icon={KeyboardArrowRightIcon} className={className} />;
};

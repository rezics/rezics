import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import {ArrowButton} from './ArrowButton';
import React from 'react';

type ArrowLeftProps = Omit<React.ComponentProps<typeof ArrowButton>, 'icon'>;

export const ArrowLeft: React.FC<ArrowLeftProps> = ({className}) => {
  return <ArrowButton icon={KeyboardArrowLeftIcon} className={className} />;
};

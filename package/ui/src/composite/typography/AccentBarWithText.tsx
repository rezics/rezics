import {Typography} from '@mui/material';
import React from 'react';
import {AccentBar, AccentBarProps} from '@/primitive/decorative/AccentBar';

export interface AccentBarWithTextProps extends AccentBarProps {
  text: React.ReactNode;
  typographyVariant?: React.ComponentProps<typeof Typography>['variant'];
  typographyProps?: Omit<React.ComponentProps<typeof Typography>, 'variant'>;
  gap?: number;
}

export const AccentBarWithText: React.FC<AccentBarWithTextProps> = ({
  text,
  typographyVariant = 'h5',
  typographyProps,
  gap = 8,
  ...barProps
}) => {
  return (
    <Typography
      variant={typographyVariant}
      className="font-bold flex items-center"
      sx={{display: 'flex', alignItems: 'center', gap: `${gap}px`}}
      {...typographyProps}
    >
      <AccentBar {...barProps} />
      {text}
    </Typography>
  );
};

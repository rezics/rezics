import React from 'react';
import {CircularProgress, Typography} from '@mui/material';

export type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  isLoading?: boolean;
};

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  isLoading,
}) => {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between">
        <div>
          <Typography variant="h6" className="font-semibold">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <CircularProgress size={18} />}
        </div>
      </div>
    </div>
  );
};


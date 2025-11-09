import {AccentBarWithTextShow} from '@component/Common/AccentBar.tsx';
import {EditButtonFloatRight} from '@component/Common/EditButtonFloatRight.tsx';
import {Box, Typography} from '@mui/material';
import React from 'react';
import {useTranslation} from 'react-i18next';
import type {BookDescriptionShowProps} from './types';

/**
 * Show-only component for rendering a book description.
 * - Displays a localized title bar and the description text.
 * - Optionally shows an edit button via `showEditButton` and calls `onEdit` when clicked.
 */
export const BookDescriptionShow: React.FC<BookDescriptionShowProps> = ({
  description,
  onEdit,
  showEditButton = true,
}) => {
  const {t} = useTranslation();
  return (
    <div>
      <Box>
        <div className="flex mb-4">
          <AccentBarWithTextShow text={t('book.description')} />{' '}
          {/* {showEditButton && <EditButtonFloatRight.Show onClick={onEdit} />} */}
        </div>{' '}
        <Typography variant="body1" className="whitespace-pre-line">
          {description}
        </Typography>
      </Box>{' '}
    </div>
  );
};

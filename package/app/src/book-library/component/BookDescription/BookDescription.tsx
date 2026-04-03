import {AccentBarWithText} from '@rezics/ui/composite/typography/AccentBarWithText.tsx';
import {EditButtonFloatRightShow} from '@rezics/ui/composite/button/EditButtonFloatRight.tsx';
import {Box, Typography} from '@mui/material';
import React from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate} from '@tanstack/react-router';
import type {BookDescriptionProps} from './types';

/**
 * Direct component for rendering a book description.
 * - Displays a localized title bar and the description text.
 * - Optional edit button routes to edit page or calls `onEdit`.
 */
export const BookDescription: React.FC<BookDescriptionProps> = ({
  description,
  onEdit,
  bookId,
  showEditButton,
}) => {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const canEdit = Boolean(onEdit || bookId);
  const shouldShowEdit = showEditButton ?? canEdit;

  const handleEdit = () => {
    if (onEdit) {
      onEdit();
      return;
    }
    if (bookId) {
      navigate({to: `/book/${bookId}/edit`});
    }
  };

  return (
    <div>
      <Box>
        <div className="flex mb-4">
          <AccentBarWithText text={t('book.description')} />
          {shouldShowEdit && (
            <EditButtonFloatRightShow
              onClick={handleEdit}
              text={t('common.edit')}
            />
          )}
        </div>{' '}
        <Typography variant="body1" className="whitespace-pre-line">
          {description}
        </Typography>
      </Box>{' '}
    </div>
  );
};

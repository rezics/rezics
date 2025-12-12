import {Button} from '@mui/material';
import React from 'react';
import EasyEditor from '@component/Form/EasyEditor.tsx';
import type {BookDescriptionEditShowProps} from './types';
import {useTranslation} from 'react-i18next';

/**
 * Pure editor view for editing a book description.
 * - Controlled via `descriptionState` and `setDescriptionState`.
 * - Calls `onUpdate` with the new description when user submits.
 * - Calls `setEditOpen(false)` after successful submit (no-op for inline).
 */
export const BookDescriptionEditShow: React.FC<
  BookDescriptionEditShowProps
> = ({onUpdate, setEditOpen, descriptionState, setDescriptionState}) => {
  const {t} = useTranslation();
  const handleUpdate = () => {
    onUpdate(descriptionState);
    setEditOpen(false);
  };

  return (
    <div>
      <EasyEditor value={descriptionState} onChange={setDescriptionState} />
      <div className="w-full">
        <div className="w-1/2 float-right">
          <Button onClick={handleUpdate} className="w-full">
            {t('common.submit')}
          </Button>
        </div>
      </div>
    </div>
  );
};

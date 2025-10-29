import {Button} from '@mui/material';
import React from 'react';
import EasyEditor from '@component/Form/EasyEditor.tsx';
import type {BookDescriptionEditShowProps} from './types';

/**
 * Pure editor view for editing a book description.
 * - Controlled via `descriptionState` and `setDescriptionState`.
 * - Calls `onUpdate` with the new description when user submits.
 * - Calls `setEditOpen(false)` after successful submit (no-op for inline).
 */
export const BookDescriptionEditShow: React.FC<
  BookDescriptionEditShowProps
> = ({onUpdate, setEditOpen, descriptionState, setDescriptionState}) => {
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
            提交
          </Button>
        </div>
      </div>
    </div>
  );
};

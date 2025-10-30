import React from 'react';

import {TextField} from '@mui/material';

interface BookTitleEditorProps {
  title: string;
}

export const BookTitleEditor: React.FC<BookTitleEditorProps> = ({title}) => {
  return (
    <div>
      <TextField
        id="standard-basic"
        label=""
        variant="standard"
        defaultValue={title}
      />
    </div>
  );
};

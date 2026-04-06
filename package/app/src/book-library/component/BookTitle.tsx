import { TextField } from "@mui/material";
import type React from "react";

interface BookTitleEditorProps {
  title: string;
}

export const BookTitleEditor: React.FC<BookTitleEditorProps> = ({ title }) => {
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

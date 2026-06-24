import { Input } from "@rezics/ui/shadcn";
import type React from "react";

interface BookTitleEditorProps {
  title: string;
}

export const BookTitleEditor: React.FC<BookTitleEditorProps> = ({ title }) => {
  return (
    <div>
      <Input id="standard-basic" defaultValue={title} />
    </div>
  );
};

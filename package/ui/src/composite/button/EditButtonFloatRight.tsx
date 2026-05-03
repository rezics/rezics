import { Button } from "@mui/material";
import type React from "react";
import { Pencil as Edit } from "lucide-react";

export type EditButtonFloatRightShowProps = {
  onClick?: () => void;
  text?: string;
};

export const EditButtonFloatRightShow: React.FC<
  EditButtonFloatRightShowProps
> = ({ onClick, text = "编辑" }) => {
  return (
    <div className="flex-1 justify-end">
      <Button
        variant="text"
        startIcon={<Edit />}
        className="float-right"
        onClick={onClick}
      >
        {text}
      </Button>
    </div>
  );
};

export type EditButtonFloatRightContainerProps = EditButtonFloatRightShowProps;
export const EditButtonFloatRightContainer: React.FC<
  EditButtonFloatRightContainerProps
> = (props) => {
  return <EditButtonFloatRightShow {...props} />;
};

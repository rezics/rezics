import type React from "react";
import { Pencil as Edit } from "lucide-react";
import { Button } from "#/shadcn/button";

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
        type="button"
        variant="ghost"
        className="float-right"
        onClick={onClick}
      >
        <Edit className="size-4" />
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

import { Edit } from "@mui/icons-material";
import { Button } from "@mui/material";

export namespace EditButtonFloatRight {
  export type Show = {
    onClick?: () => void;
    text?: string;
  };

  export const Show: React.FC<Show> = ({ onClick, text = "编辑" }) => {
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

  export type Container = Show;
  export const Container: React.FC<Container> = (props) => {
    return <Show {...props} />;
  };
}

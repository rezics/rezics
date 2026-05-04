import { Spinner } from "@rezics/ui";
import type { FC, ReactNode } from "react";

export const UserLoading: FC<{ height?: number }> = ({ height = 256 }) => {
  return (
    <div
      className="flex items-center justify-center"
      style={{ height }}
    >
      <Spinner />
    </div>
  );
};

export const UserError: FC<{ message?: ReactNode; height?: number }> = ({
  message = "Something went wrong",
  height = 256,
}) => {
  return (
    <div
      className="flex items-center justify-center"
      style={{ height }}
    >
      <p className="text-error-text">{message}</p>
    </div>
  );
};

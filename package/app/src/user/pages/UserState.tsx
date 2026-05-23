import { Spinner } from "@rezics/ui";
import * as m from "@rezics/i18n/messages";
import type { FC, ReactNode } from "react";

export const UserLoading: FC<{ height?: number }> = ({ height = 256 }) => {
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <Spinner />
    </div>
  );
};

export const UserError: FC<{ message?: ReactNode; height?: number }> = ({
  message = m.common_unexpected_error(),
  height = 256,
}) => {
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <p className="text-error-text">{message}</p>
    </div>
  );
};

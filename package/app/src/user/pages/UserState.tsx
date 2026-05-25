import { Spinner } from "@rezics/ui";
import type { FC, ReactNode } from "react";
import { useMessage } from "@rezics/i18n/react";
import { common_unexpected_error } from "@rezics/i18n/messages";
const m = {
  common_unexpected_error,
};

const i18nMessages = {
  common_unexpected_error,
};

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
  const m = useMessage(i18nMessages);
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <p className="text-error-text">{message}</p>
    </div>
  );
};

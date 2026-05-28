import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import type { FC, ReactNode } from "react";

import { getI18nRuntime } from "@rezics/i18n/runtime";
export const UserLoading: FC<{ height?: number }> = ({ height = 256 }) => {
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <Spinner />
    </div>
  );
};

export const UserError: FC<{ message?: ReactNode; height?: number }> = ({
  message = i18nMessages.getI18nRuntime().i18n.t("common:unexpected_error"),
  height = 256,
}) => {
  const { t } = useTranslation("common");
return (
    <div className="flex items-center justify-center" style={{ height }}>
      <p className="text-error-text">{message}</p>
    </div>
  );
};

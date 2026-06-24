import { useTranslation } from "@rezics/i18n/react";
import type { FC, ReactNode } from "react";

interface DangerZoneProps {
  title?: string;
  description?: string;
  children: ReactNode;
}

export const DangerZone: FC<DangerZoneProps> = ({
  title,
  description,
  children,
}) => {
  const { t } = useTranslation("settings");
  const resolvedTitle = title ?? t("danger_zone");

  return (
    <section className="mt-8 rounded-lg border border-border-error/30 p-4">
      <h6 className="text-base font-semibold text-error-text mb-1">
        {resolvedTitle}
      </h6>
      {description && (
        <p className="text-sm text-text-secondary mb-4">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
};

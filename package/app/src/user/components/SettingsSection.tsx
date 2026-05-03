import { Separator } from "@rezics/ui/shadcn";
import type { FC, ReactNode } from "react";

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  divider?: boolean;
}

export const SettingsSection: FC<SettingsSectionProps> = ({
  title,
  description,
  children,
  divider = true,
}) => (
  <>
    <section className="py-8">
      <h6 className="text-base font-semibold mb-1">{title}</h6>
      {description && (
        <p className="text-sm text-rezics-color-fg-muted mb-4">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
    {divider && <Separator />}
  </>
);

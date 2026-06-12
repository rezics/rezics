import { Separator } from "@rezics/ui/shadcn";
import type { FC, ReactNode } from "react";

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  divider?: boolean;
}

/**
 * A reusable settings section container for organizing related settings groups.
 * 设置分组容器，用于组织相关的设置项。
 *
 * Layout:
 *
 * Mobile (<640px):
 * ┌─────────────────────┐
 * │ Title               │
 * │ Description         │
 * │                     │
 * │ [Content]           │
 * │ [Content]           │
 * ├─────────────────────┤
 * │ ─────────────────── │ (divider)
 * └─────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────┐
 * │ Title                      │
 * │ Description text           │
 * │                            │
 * │ [Content]   [Content]      │
 * ├────────────────────────────┤
 * │ ─────────────────────────── │ (divider)
 * └────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌────────────────────────────────────┐
 * │ Title                              │
 * │ Descriptive text explaining intent │
 * │                                    │
 * │ [Content] [Content] [Content]      │
 * ├────────────────────────────────────┤
 * │ ────────────────────────────────── │ (divider)
 * └────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌──────────────────────────────────────────┐
 * │ Title                                    │
 * │ Descriptive text explaining section use  │
 * │                                          │
 * │ [Content] [Content] [Content] [Content]  │
 * ├──────────────────────────────────────────┤
 * │ ─────────────────────────────────────── │ (divider)
 * └──────────────────────────────────────────┘
 */
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
        <p className="text-sm text-text-secondary mb-4">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
    {divider && <Separator />}
  </>
);

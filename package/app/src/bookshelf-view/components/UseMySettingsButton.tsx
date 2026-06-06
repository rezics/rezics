import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import type React from "react";

export interface UseMySettingsButtonProps {
  /** Whether a URL override is currently active (the button only matters then). */
  hasUrlOverride: boolean;
  /** Reset the bookshelf layout back to the viewer's stored settings. */
  onReset: () => void;
  className?: string;
}

/**
 * Resets the bookshelf layout from a URL override back to the viewer's own
 * `userSettings.library.bookshelf` preference. Hidden when no override is
 * active, since there is nothing to reset.
 */
export const UseMySettingsButton: React.FC<UseMySettingsButtonProps> = ({
  hasUrlOverride,
  onReset,
  className,
}) => {
  const { t } = useTranslation(["common", "settings"]);
  if (!hasUrlOverride) return null;
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={className}
      onClick={onReset}
    >
      {t("settings:bookshelf_use_my_settings")}
    </Button>
  );
};

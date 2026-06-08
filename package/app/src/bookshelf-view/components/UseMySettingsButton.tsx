import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import type React from "react";

export interface UseMySettingsButtonProps {
  /** Whether a URL override is currently active (the button only matters then). 是否当前存在 URL 覆盖（仅此时按钮才有意义）。 */
  hasUrlOverride: boolean;
  /** Reset the bookshelf layout back to the viewer's stored settings. 将书架布局重置回查看者已存储的设置。 */
  onReset: () => void;
  className?: string;
}

/**
 * Resets the bookshelf layout from a URL override back to the viewer's own
 * `userSettings.library.bookshelf` preference. Hidden when no override is
 * active, since there is nothing to reset.
 * 将书架布局从 URL 覆盖重置回查看者自己的 `userSettings.library.bookshelf`
 * 偏好。无覆盖激活时隐藏，因为没有可重置的内容。
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

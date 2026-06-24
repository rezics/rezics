import { useTranslation } from "@rezics/i18n/react";
import { BadgeCheck } from "lucide-react";

interface EntityVerifiedIconProps {
  verified?: boolean | null;
}

export function EntityVerifiedIcon({ verified }: EntityVerifiedIconProps) {
  const { t } = useTranslation(["entity"]);
  if (!verified) return null;

  return (
    <BadgeCheck
      className="h-4 w-4 text-text-brand"
      aria-label={t("entity:verified")}
    />
  );
}

import { BadgeCheck } from "lucide-react";
import { useMessage } from "@rezics/i18n/react";
import { entity_verified } from "@rezics/i18n/messages";
const i18nMessages = {
  entity_verified,
};

interface EntityVerifiedIconProps {
  verified?: boolean | null;
}

export function EntityVerifiedIcon({ verified }: EntityVerifiedIconProps) {
  const m = useMessage(i18nMessages);
  if (!verified) return null;

  return (
    <BadgeCheck
      className="h-4 w-4 text-text-brand"
      aria-label={m.entity_verified()}
    />
  );
}

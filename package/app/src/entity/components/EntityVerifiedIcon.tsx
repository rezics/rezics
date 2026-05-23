import { BadgeCheck } from "lucide-react";
import * as m from "@rezics/i18n/messages";

interface EntityVerifiedIconProps {
  verified?: boolean | null;
}

export function EntityVerifiedIcon({ verified }: EntityVerifiedIconProps) {
  if (!verified) return null;

  return (
    <BadgeCheck
      className="h-4 w-4 text-text-brand"
      aria-label={m.entity_verified()}
    />
  );
}

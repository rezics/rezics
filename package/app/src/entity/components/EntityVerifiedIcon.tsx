import { BadgeCheck } from "lucide-react";

interface EntityVerifiedIconProps {
  verified?: boolean | null;
}

export function EntityVerifiedIcon({ verified }: EntityVerifiedIconProps) {
  if (!verified) return null;

  return (
    <BadgeCheck
      className="h-4 w-4 text-text-brand"
      aria-label="Verified entity"
    />
  );
}

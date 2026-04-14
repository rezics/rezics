import type { Permission } from "@rezics/contract";

export function shouldShowVerificationBanner(
  permission: Permission | null,
  needsVerification: boolean,
) {
  return permission !== null && needsVerification;
}

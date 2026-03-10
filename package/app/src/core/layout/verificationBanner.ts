export function shouldShowVerificationBanner(
  hasAuthSession: boolean,
  needsVerification: boolean,
) {
  return hasAuthSession && needsVerification;
}

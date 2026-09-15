import { ApiPermissionValues } from "./api-permissions";

/** Protocol identity/offline scopes accompany explicit API entry scopes; profile/email disclosure is not implicit. @internal */
export const SupportedOAuthScopes = ["openid", "offline_access", ...ApiPermissionValues] as const;
/** Distinct credential prefixes prevent OAuth/personal-key/session fallback or type confusion. @internal */
export const OAuthCredentialPrefixes = {
	accessToken: "rz_oat_",
	refreshToken: "rz_ort_",
	clientSecret: "rz_ocs_",
} as const;

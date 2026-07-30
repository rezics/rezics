import { value } from "native-i18n";

/**
 * Typed rich-text slots used to place policy links inside localized authentication copy.
 *
 * @alpha
 */
export const AuthPolicyNoticeSlots = {
	userAgreement: { kind: "userAgreement" },
	privacyPolicy: { kind: "privacyPolicy" },
} as const;

export type AuthPolicyNoticeSlot =
	(typeof AuthPolicyNoticeSlots)[keyof typeof AuthPolicyNoticeSlots];

/** @internal */
export const AuthPolicyNoticeBindings = {
	userAgreement: value<(typeof AuthPolicyNoticeSlots)["userAgreement"]>(),
	privacyPolicy: value<(typeof AuthPolicyNoticeSlots)["privacyPolicy"]>(),
} as const;

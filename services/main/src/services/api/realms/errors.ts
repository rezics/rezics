import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class RealmNotFound extends HTTPError.id("RealmNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "Realm not found";
}

export class RealmMembershipNotFound extends HTTPError.id(
	"RealmMembershipNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Realm membership not found";
}

export class RealmOwnerLeaveForbidden extends HTTPError.id(
	"RealmOwnerLeaveForbidden",
	StatusCodes.CONFLICT,
) {
	override readonly message = "The Realm owner cannot leave";
}

export class RealmRuleRevisionChanged extends HTTPError.id(
	"RealmRuleRevisionChanged",
	StatusCodes.CONFLICT,
) {
	override readonly message = "The current Realm rule revision has changed";

	constructor(readonly details: { readonly currentRevisionId: string | null }) {
		super();
	}
}

export class RealmMemberNotFound extends HTTPError.id(
	"RealmMemberNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message: string;

	constructor(active = false) {
		super();
		this.message = active ? "Active Realm member not found" : "Realm member not found";
	}
}

export class RealmUnitNotFound extends HTTPError.id("RealmUnitNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "Realm Unit not found";
}

export class RealmScoreContextPostNotMounted extends HTTPError.id(
	"RealmScoreContextPostNotMounted",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "The score context Post must be mounted in the Realm";
}

export class RealmScoreContextPostKindInvalid extends HTTPError.id(
	"RealmScoreContextPostKindInvalid",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "The score context must be an ordinary or Wiki Post";
}

export class RealmTagContextNotFound extends HTTPError.id(
	"RealmTagContextNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Realm Tag Context not found";
}

export class RealmTagContextAlreadyExists extends HTTPError.id(
	"RealmTagContextAlreadyExists",
	StatusCodes.CONFLICT,
) {
	override readonly message = "A Realm Tag Context already exists for this Tag";

	constructor(readonly details: { readonly contextPostId: string }) {
		super();
	}
}

export class RealmTagContextPostNotMounted extends HTTPError.id(
	"RealmTagContextPostNotMounted",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "The Realm Tag Context must be a visible Wiki Post in the Realm";
}

export class RealmTagContextPostAlreadyUsed extends HTTPError.id(
	"RealmTagContextPostAlreadyUsed",
	StatusCodes.CONFLICT,
) {
	override readonly message = "The Wiki Post already explains another Realm Tag";
}

export class RealmTagVotingDisabled extends HTTPError.id(
	"RealmTagVotingDisabled",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Realm-scoped Tag voting is not enabled for this Realm";
}

export class RealmTagContextRequired extends HTTPError.id(
	"RealmTagContextRequired",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message =
		"This Realm must explicitly explain the Tag before it can receive votes";
}

export class RealmTagSelfReferenceForbidden extends HTTPError.id(
	"RealmTagSelfReferenceForbidden",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "A Tag cannot be applied to itself";
}

export class WikiNavigationNotFound extends HTTPError.id(
	"WikiNavigationNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Realm Wiki navigation not found";
}

export class WikiNavigationInUse extends HTTPError.id("WikiNavigationInUse", StatusCodes.CONFLICT) {
	override readonly message = "Realm Wiki navigation is still referenced by a Dock document";
}

export class WikiNavigationDocumentInvalid extends HTTPError.id(
	"WikiNavigationDocumentInvalid",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "Realm Wiki navigation document is invalid";
}

export const RealmErrors = [
	RealmNotFound,
	RealmMembershipNotFound,
	RealmOwnerLeaveForbidden,
	RealmRuleRevisionChanged,
	RealmMemberNotFound,
	RealmUnitNotFound,
	RealmScoreContextPostNotMounted,
	RealmScoreContextPostKindInvalid,
	RealmTagContextNotFound,
	RealmTagContextAlreadyExists,
	RealmTagContextPostNotMounted,
	RealmTagContextPostAlreadyUsed,
	RealmTagVotingDisabled,
	RealmTagContextRequired,
	RealmTagSelfReferenceForbidden,
	WikiNavigationNotFound,
	WikiNavigationInUse,
	WikiNavigationDocumentInvalid,
] as const;

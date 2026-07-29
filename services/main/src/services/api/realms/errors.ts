import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class RealmNotFound extends Data.TaggedError("RealmNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = RealmNotFound.status;
	readonly message = "Realm not found";
}

export class RealmMembershipNotFound extends Data.TaggedError("RealmMembershipNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = RealmMembershipNotFound.status;
	readonly message = "Realm membership not found";
}

export class RealmOwnerLeaveForbidden extends Data.TaggedError("RealmOwnerLeaveForbidden") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = RealmOwnerLeaveForbidden.status;
	readonly message = "The Realm owner cannot leave";
}

export class RealmRuleRevisionChanged extends Data.TaggedError("RealmRuleRevisionChanged") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = RealmRuleRevisionChanged.status;
	readonly message = "The current Realm rule revision has changed";

	constructor(readonly details: { readonly currentRevisionId: string | null }) {
		super();
	}
}

export class RealmMemberNotFound extends Data.TaggedError("RealmMemberNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = RealmMemberNotFound.status;
	readonly message: string;

	constructor(active = false) {
		super();
		this.message = active ? "Active Realm member not found" : "Realm member not found";
	}
}

export class RealmUnitNotFound extends Data.TaggedError("RealmUnitNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = RealmUnitNotFound.status;
	readonly message = "Realm Unit not found";
}

export class RealmScoreContextPostNotMounted extends Data.TaggedError(
	"RealmScoreContextPostNotMounted",
) {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = RealmScoreContextPostNotMounted.status;
	readonly message = "The score context Post must be mounted in the Realm";
}

export class RealmScoreContextPostKindInvalid extends Data.TaggedError(
	"RealmScoreContextPostKindInvalid",
) {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = RealmScoreContextPostKindInvalid.status;
	readonly message = "The score context must be an ordinary or Wiki Post";
}

export class RealmTagContextNotFound extends Data.TaggedError("RealmTagContextNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = RealmTagContextNotFound.status;
	readonly message = "Realm Tag Context not found";
}

export class RealmTagContextAlreadyExists extends Data.TaggedError("RealmTagContextAlreadyExists") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = RealmTagContextAlreadyExists.status;
	readonly message = "A Realm Tag Context already exists for this Tag";

	constructor(readonly details: { readonly contextPostId: string }) {
		super();
	}
}

export class RealmTagContextPostNotMounted extends Data.TaggedError(
	"RealmTagContextPostNotMounted",
) {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = RealmTagContextPostNotMounted.status;
	readonly message = "The Realm Tag Context must be a visible Wiki Post in the Realm";
}

export class RealmTagContextPostAlreadyUsed extends Data.TaggedError(
	"RealmTagContextPostAlreadyUsed",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = RealmTagContextPostAlreadyUsed.status;
	readonly message = "The Wiki Post already explains another Realm Tag";
}

export class RealmTagSelfReferenceForbidden extends Data.TaggedError(
	"RealmTagSelfReferenceForbidden",
) {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = RealmTagSelfReferenceForbidden.status;
	readonly message = "A Tag cannot be applied to itself";
}

export class WikiNavigationNotFound extends Data.TaggedError("WikiNavigationNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = WikiNavigationNotFound.status;
	readonly message = "Realm Wiki navigation not found";
}

export class WikiNavigationInUse extends Data.TaggedError("WikiNavigationInUse") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = WikiNavigationInUse.status;
	readonly message = "Realm Wiki navigation is still referenced by a Dock document";
}

export class WikiNavigationDocumentInvalid extends Data.TaggedError(
	"WikiNavigationDocumentInvalid",
) {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = WikiNavigationDocumentInvalid.status;
	readonly message = "Realm Wiki navigation document is invalid";
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
	RealmTagSelfReferenceForbidden,
	WikiNavigationNotFound,
	WikiNavigationInUse,
	WikiNavigationDocumentInvalid,
] as const;

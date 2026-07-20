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

export const RealmErrors = [
	RealmNotFound,
	RealmMembershipNotFound,
	RealmOwnerLeaveForbidden,
	RealmMemberNotFound,
	RealmUnitNotFound,
	RealmScoreContextPostNotMounted,
] as const;

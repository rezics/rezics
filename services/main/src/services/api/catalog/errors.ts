import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class EntityEntryNotFound extends Data.TaggedError("EntityEntryNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = EntityEntryNotFound.status;
	readonly message = "Entity entry not found";
}

export class AliasNotFound extends Data.TaggedError("AliasNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = AliasNotFound.status;
	readonly message = "Alias not found";
}

export class TagApplicationNotFound extends Data.TaggedError("TagApplicationNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = TagApplicationNotFound.status;
	readonly message: string;

	constructor(afterUpsert = false) {
		super();
		this.message = afterUpsert
			? "Tag application not found after upsert"
			: "Tag application not found";
	}
}

export class UnitVersionNotFound extends Data.TaggedError("UnitVersionNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = UnitVersionNotFound.status;
	readonly message = "Unit version not found";
}

export const CatalogErrors = [
	EntityEntryNotFound,
	AliasNotFound,
	TagApplicationNotFound,
	UnitVersionNotFound,
] as const;

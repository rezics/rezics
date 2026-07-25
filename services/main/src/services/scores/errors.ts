import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class ScoreContextUnitUnsupported extends Data.TaggedError("ScoreContextUnitUnsupported") {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = ScoreContextUnitUnsupported.status;
	readonly message = "Score context Unit must be a Realm";
}

export const ScoreErrors = [ScoreContextUnitUnsupported] as const;

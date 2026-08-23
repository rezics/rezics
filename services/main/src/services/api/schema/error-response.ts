import { t } from "elysia";

import type { ApiErrorCode } from "../errors";

export const toApiErrorResponse = <const Codes extends readonly [ApiErrorCode, ...ApiErrorCode[]]>(
	codes: Codes,
) =>
	t.Object({
		error: t.Object({
			code: t.UnionEnum(codes),
			message: t.String(),
			details: t.Optional(t.Unknown()),
		}),
		requestId: t.String(),
	});

export const VndbVoteBackpressureResponse = toApiErrorResponse(["VndbVoteHotKeyBusy"]);
export const TagApplicationPolicyResponse = toApiErrorResponse([
	"TagNotDirectlyApplicable",
	"ContentLabelApplicationInvalid",
]);

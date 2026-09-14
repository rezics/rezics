import { encryptOpaqueValue, decryptOpaqueValue } from "../../authorization/opaque-values";
import type { StaticDecode } from "typebox";
import { Check, Decode } from "typebox/value";
import { t } from "elysia";
import type { ContentLanguage } from "@rezics/i18n";
import type { Authorization } from "../../authorization";
import { env } from "../../config";
import { InvalidPaginationCursor } from "../../pagination/errors";
import { FractionalPosition, Uuid } from "../schema";
const Boundary = t.Object(
	{ position: FractionalPosition, targetId: Uuid },
	{ additionalProperties: false },
);
type Boundary = StaticDecode<typeof Boundary>;
const Prefix = "ci2.";
const MaximumTokenLength = 4096;
const KeyContext = "rezics:collection-items-cursor:v2";
export interface CollectionItemsCursorScope {
	readonly collectionId: string;
	readonly revisionId: string;
	readonly authorization: Pick<
		Authorization,
		"profileId" | "authUserId" | "participationAuthority"
	>;
	readonly localizationLanguages: readonly ContentLanguage[];
}
function associatedData(scope: CollectionItemsCursorScope) {
	const auth = scope.authorization,
		authority = auth.participationAuthority,
		principal = authority?.principal;
	return Buffer.from(
		JSON.stringify([
			KeyContext,
			scope.collectionId,
			scope.revisionId,
			auth.authUserId ?? null,
			auth.profileId ?? null,
			principal?.kind ?? null,
			principal?.authUserId ?? null,
			principal?.kind === "service" ? principal.servicePrincipalId : null,
			authority?.actingEntityId ?? null,
			authority?.authorizationRevision ?? null,
			authority?.grant?.id ?? null,
			authority?.grant?.revision ?? null,
			scope.localizationLanguages,
		]),
	);
}
/** Encrypt the consumed membership boundary; it can name a member the viewer cannot read. @internal */
export function encodeCollectionItemsCursor(
	boundary: Boundary,
	scope: CollectionItemsCursorScope,
): string {
	if (!Check(Boundary, boundary)) throw new TypeError("Invalid Collection membership boundary");
	return encryptOpaqueValue(Buffer.from(JSON.stringify(boundary), "utf8"), associatedData(scope), {
		secret: env.BETTER_AUTH_SECRET, keyContext: KeyContext, prefix: Prefix, maximumLength: MaximumTokenLength,
	});
}
/** Authenticate the scope before parsing a continuation. This never grants member or Collection access. @internal */
export function decodeCollectionItemsCursor(
	value: string | undefined,
	scope: CollectionItemsCursorScope,
): Boundary | null {
	if (!value) return null;
	try {
		const plaintext = decryptOpaqueValue(value, associatedData(scope), {
			secret: env.BETTER_AUTH_SECRET, keyContext: KeyContext, prefix: Prefix, maximumLength: MaximumTokenLength,
		});
		const boundary: unknown = JSON.parse(plaintext.toString("utf8"));
		if (!Check(Boundary, boundary)) throw new InvalidPaginationCursor();
		return Decode(Boundary, boundary);
	} catch {
		throw new InvalidPaginationCursor();
	}
}

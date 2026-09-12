import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
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
const SaltBytes = 16,
	NonceBytes = 12,
	TagBytes = 16,
	MaximumTokenLength = 4096;
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
function key(salt: Buffer) {
	return Buffer.from(hkdfSync("sha256", env.BETTER_AUTH_SECRET, salt, KeyContext, 32));
}
/** Encrypt the consumed membership boundary; it can name a member the viewer cannot read. @internal */
export function encodeCollectionItemsCursor(
	boundary: Boundary,
	scope: CollectionItemsCursorScope,
): string {
	if (!Check(Boundary, boundary)) throw new TypeError("Invalid Collection membership boundary");
	// Independent per-token keys and nonces avoid a deployment-wide GCM nonce counter.
	const salt = randomBytes(SaltBytes),
		nonce = randomBytes(NonceBytes);
	const cipher = createCipheriv("aes-256-gcm", key(salt), nonce, { authTagLength: TagBytes });
	cipher.setAAD(associatedData(scope));
	const ciphertext = Buffer.concat([
		cipher.update(JSON.stringify(boundary), "utf8"),
		cipher.final(),
	]);
	const token =
		Prefix + Buffer.concat([salt, nonce, ciphertext, cipher.getAuthTag()]).toString("base64url");
	if (token.length > MaximumTokenLength)
		throw new RangeError("Collection continuation exceeds its transport budget");
	return token;
}
/** Authenticate the scope before parsing a continuation. This never grants member or Collection access. @internal */
export function decodeCollectionItemsCursor(
	value: string | undefined,
	scope: CollectionItemsCursorScope,
): Boundary | null {
	if (!value) return null;
	try {
		if (value.length > MaximumTokenLength || !value.startsWith(Prefix))
			throw new InvalidPaginationCursor();
		const encoded = value.slice(Prefix.length);
		if (!/^[A-Za-z0-9_-]+$/u.test(encoded)) throw new InvalidPaginationCursor();
		const bytes = Buffer.from(encoded, "base64url");
		if (
			bytes.toString("base64url") !== encoded ||
			bytes.length <= SaltBytes + NonceBytes + TagBytes
		)
			throw new InvalidPaginationCursor();
		const salt = bytes.subarray(0, SaltBytes),
			nonce = bytes.subarray(SaltBytes, SaltBytes + NonceBytes);
		const decipher = createDecipheriv("aes-256-gcm", key(salt), nonce, { authTagLength: TagBytes });
		decipher.setAAD(associatedData(scope));
		decipher.setAuthTag(bytes.subarray(-TagBytes));
		const plaintext = Buffer.concat([
			decipher.update(bytes.subarray(SaltBytes + NonceBytes, -TagBytes)),
			decipher.final(),
		]);
		const boundary: unknown = JSON.parse(plaintext.toString("utf8"));
		if (!Check(Boundary, boundary)) throw new InvalidPaginationCursor();
		return Decode(Boundary, boundary);
	} catch {
		throw new InvalidPaginationCursor();
	}
}

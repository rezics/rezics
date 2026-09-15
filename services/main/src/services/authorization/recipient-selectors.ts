import { encryptOpaqueValue, decryptOpaqueValue } from "./opaque-values";
import { z } from "zod";
import { RequestedAuthoritySelectionSchema } from "./authority-context";

const contextSchema = z.strictObject({
	principalId: z.uuid().toLowerCase(),
	/** A short server-owned credential/client-context key, never an unverified request field. */
	audience: z.string().min(1).max(512),
	selection: RequestedAuthoritySelectionSchema,
	scopeId: z.uuid().toLowerCase(),
	purpose: z.enum(["group-membership", "membership", "organization-recovery", "role-binding", "representation", "account-administration", "moderation-actor"]),
});
const payloadSchema = z.strictObject({
	subjectId: z.uuid().toLowerCase(),
	issuedAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
	expiresAt: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
}).refine(payload => payload.expiresAt > payload.issuedAt && payload.expiresAt - payload.issuedAt <= 300_000);

/** Authenticated viewer/context binding for a purpose-scoped private subject selector. @internal */
export type PrivateRecipientContext = z.infer<typeof contextSchema>;
/** Invalid, expired or context-mismatched selectors have one non-disclosing outcome. @internal */
export class PrivateRecipientSelectorInvalid extends Error {
	constructor() { super("Private recipient selector is invalid or no longer usable"); }
}
function associatedData(input: PrivateRecipientContext) {
	const context = contextSchema.parse(input);
	if (context.selection.mode === "represented") context.selection.representations.sort((a, b) =>
		a.id < b.id ? -1 : a.id > b.id ? 1 : a.revision - b.revision);
	const bytes = Buffer.from(JSON.stringify(context), "utf8");
	if (bytes.length > 8192) throw new PrivateRecipientSelectorInvalid();
	return bytes;
}

/**
 * Encrypt private subject selectors without exposing a stable global identity in their payload.
 * @internal
 * @remarks Construct with server secret material shared by the intended service
 * replicas. HKDF separates this encryption key from other secret uses. Mint only
 * after current purpose/scope disclosure admission; resolve only after current
 * mutation/view admission, then revalidate the decoded recipient and every live
 * dependency. A selector chooses a subject; it is never authorization. Bind audience
 * to the verified credential/client domain context, and keep tokens out of logs.
 */
export function createPrivateRecipientSelectors(secret: Uint8Array) {
	if (secret.byteLength < 32) throw new Error("Private recipient selectors require at least 32 bytes of server secret material");
	const settings = { secret: Buffer.from(secret), keyContext: "rezics:private-recipient-selector:v1", prefix: "rzr1.", maximumLength: 512 };
	return {
		/** Produce a randomized selector with a lifetime of at most five minutes. */
		mint(subjectId: string, context: PrivateRecipientContext, now: number, lifetimeMs = 300_000): string {
			const payload = payloadSchema.parse({ subjectId, issuedAt: now, expiresAt: now + lifetimeMs });
			return encryptOpaqueValue(Buffer.from(JSON.stringify(payload), "utf8"), associatedData(context), settings);
		},
		/** Decode a selector only in its original current viewer/context; the result remains private. */
		resolve(token: string, context: PrivateRecipientContext, now: number): string {
			try {
				if (!Number.isSafeInteger(now) || now < 0 || typeof token !== "string" || token.length > 512 || !/^rzr1\.[A-Za-z0-9_-]+$/.test(token))
					throw new PrivateRecipientSelectorInvalid();
				const clear = decryptOpaqueValue(token, associatedData(context), settings);
				const payload = payloadSchema.parse(JSON.parse(clear.toString("utf8")));
				if (payload.issuedAt > now || payload.expiresAt <= now) throw new PrivateRecipientSelectorInvalid();
				return payload.subjectId;
			} catch {
				throw new PrivateRecipientSelectorInvalid();
			}
		},
	};
}

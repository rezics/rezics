import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/** Fixed-purpose confidential token configuration; no field conveys authorization. @internal */
export interface OpaqueValueSettings {
	secret: string | Uint8Array;
	keyContext: string;
	prefix: string;
	maximumLength: number;
}
const SaltBytes = 16, NonceBytes = 12, TagBytes = 16;
function validate(settings: OpaqueValueSettings) {
	if (!Number.isSafeInteger(settings.maximumLength) || settings.maximumLength < 64 || settings.maximumLength > 65_536 ||
		!settings.prefix || !settings.keyContext) throw new TypeError("Invalid opaque token configuration");
}
function key(settings: OpaqueValueSettings, salt: Uint8Array) {
	return Buffer.from(hkdfSync("sha256", settings.secret, salt, settings.keyContext, 32));
}
/** Encrypt bounded bytes with a separate random salt/key and nonce for every token. @internal */
export function encryptOpaqueValue(value: Uint8Array, associatedData: Uint8Array, settings: OpaqueValueSettings): string {
	validate(settings);
	if (!value.byteLength || value.byteLength > settings.maximumLength) throw new RangeError("Opaque token payload exceeds its budget");
	const salt = randomBytes(SaltBytes), nonce = randomBytes(NonceBytes);
	const cipher = createCipheriv("aes-256-gcm", key(settings, salt), nonce, { authTagLength: TagBytes });
	cipher.setAAD(associatedData);
	const ciphertext = Buffer.concat([cipher.update(value), cipher.final()]);
	const token = settings.prefix + Buffer.concat([salt, nonce, ciphertext, cipher.getAuthTag()]).toString("base64url");
	if (token.length > settings.maximumLength) throw new RangeError("Opaque token exceeds its transport budget");
	return token;
}
/** Authenticate canonical encoding and context before returning any bytes for owner parsing. @internal */
export function decryptOpaqueValue(token: string, associatedData: Uint8Array, settings: OpaqueValueSettings): Buffer {
	validate(settings);
	if (typeof token !== "string" || token.length > settings.maximumLength || !token.startsWith(settings.prefix))
		throw new TypeError("Invalid opaque token");
	const encoded = token.slice(settings.prefix.length);
	if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw new TypeError("Invalid opaque token encoding");
	const bytes = Buffer.from(encoded, "base64url");
	if (bytes.toString("base64url") !== encoded || bytes.length <= SaltBytes + NonceBytes + TagBytes)
		throw new TypeError("Invalid opaque token envelope");
	const salt = bytes.subarray(0, SaltBytes), nonce = bytes.subarray(SaltBytes, SaltBytes + NonceBytes);
	const decipher = createDecipheriv("aes-256-gcm", key(settings, salt), nonce, { authTagLength: TagBytes });
	decipher.setAAD(associatedData);
	decipher.setAuthTag(bytes.subarray(-TagBytes));
	return Buffer.concat([decipher.update(bytes.subarray(SaltBytes + NonceBytes, -TagBytes)), decipher.final()]);
}

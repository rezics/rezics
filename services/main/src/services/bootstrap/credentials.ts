import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";

const BootstrapPasswordBytes = 32;
const BootstrapPasswordComplexityPrefix = "Rz1_";
export interface IssuedPlatformCredential {
	readonly action: "created" | "rotated";
	readonly name: string;
	readonly email: string;
	readonly password: string;
}

export interface PreparedPlatformCredential {
	readonly password: string;
	readonly passwordHash: string;
}

/** Generate a URL-safe credential with 256 random bits and explicit complexity classes. */
export function generateBootstrapPassword(): string {
	return (
		BootstrapPasswordComplexityPrefix +
		randomBytes(BootstrapPasswordBytes).toString("base64url")
	);
}

export async function preparePlatformCredential(): Promise<PreparedPlatformCredential> {
	const password = generateBootstrapPassword();
	return { password, passwordHash: await hashPassword(password) };
}

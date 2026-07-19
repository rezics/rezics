import { randomBytes } from "node:crypto";

const BootstrapPasswordBytes = 32;
const BootstrapPasswordComplexityPrefix = "Rz1_";

/** Generate a URL-safe credential with 256 random bits and explicit complexity classes. */
export function generateBootstrapPassword(): string {
	return (
		BootstrapPasswordComplexityPrefix +
		randomBytes(BootstrapPasswordBytes).toString("base64url")
	);
}

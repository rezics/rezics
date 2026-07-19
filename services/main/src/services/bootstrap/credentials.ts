import { randomBytes } from "node:crypto";

const BootstrapPasswordBytes = 32;
const BootstrapPasswordComplexityPrefix = "Rz1_";
const OverwriteCredentialsFlag = "--overwrite-credentials";
const ConfirmOverwriteFlag = "--yes";

export type BootstrapCredentialMode = "fill" | "overwrite";

export function parseBootstrapCredentialMode(args: readonly string[]): BootstrapCredentialMode {
	if (args.length === 0) return "fill";

	const uniqueArgs = new Set(args);
	if (
		args.length === 2 &&
		uniqueArgs.size === 2 &&
		uniqueArgs.has(OverwriteCredentialsFlag) &&
		uniqueArgs.has(ConfirmOverwriteFlag)
	)
		return "overwrite";

	if (uniqueArgs.has(OverwriteCredentialsFlag) && !uniqueArgs.has(ConfirmOverwriteFlag)) {
		throw new Error(
			`Refusing to overwrite bootstrap credentials without ${ConfirmOverwriteFlag}`,
		);
	}
	throw new Error(`Usage: bootstrap.ts [${OverwriteCredentialsFlag} ${ConfirmOverwriteFlag}]`);
}

/** Generate a URL-safe credential with 256 random bits and explicit complexity classes. */
export function generateBootstrapPassword(): string {
	return (
		BootstrapPasswordComplexityPrefix +
		randomBytes(BootstrapPasswordBytes).toString("base64url")
	);
}

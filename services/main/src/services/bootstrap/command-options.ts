export interface PlatformInstallCommandOptions {
	readonly credentialOutput: "print" | "suppress";
}

export function parsePlatformInstallCommandOptions(
	args: readonly string[],
): PlatformInstallCommandOptions {
	const uniqueArgs = new Set(args);
	if (uniqueArgs.size !== args.length)
		throw new Error("Platform installation flags must not be repeated");
	if (!uniqueArgs.has("--yes")) throw new Error("Refusing to install the platform without --yes");
	if (
		[...uniqueArgs].some(
			(value) =>
				value !== "--yes" && value !== "--if-needed" && value !== "--suppress-credential-output",
		)
	)
		throw new Error(
			"Usage: install-platform.ts --yes [--if-needed] [--suppress-credential-output]",
		);
	return {
		credentialOutput: uniqueArgs.has("--suppress-credential-output") ? "suppress" : "print",
	};
}

export function parsePlatformCredentialRotationCommand(args: readonly string[]): void {
	if (args.length !== 1 || args[0] !== "--yes")
		throw new Error("Usage: rotate-platform-credentials.ts --yes");
}

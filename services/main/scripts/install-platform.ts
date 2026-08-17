import { parsePlatformInstallCommandOptions } from "../src/services/bootstrap/command-options";
import { platformInstallationService } from "../src/services/bootstrap/service";
import { database } from "../src/services/database";

try {
	const options = parsePlatformInstallCommandOptions(process.argv.slice(2));
	const result = await platformInstallationService.install();
	if (result.status === "already_installed") {
		console.info("Platform identities are complete; no product-owned content was changed.");
	} else if (options.credentialOutput === "suppress") {
		console.info(
			`Platform identities were ensured; ${result.issuedCredentials.length} initial credentials were intentionally suppressed.`,
		);
	} else if (result.issuedCredentials.length === 0) {
		console.info("Platform identities were ensured; no new credentials were issued.");
	} else {
		console.info(
			"Platform identities were ensured. Store these initial credentials now; they will not be shown again.",
		);
		for (const credential of result.issuedCredentials) {
			console.info(
				`\n${credential.name} (${credential.action})\nEmail: ${credential.email}\nPassword: ${credential.password}`,
			);
		}
	}
} finally {
	await database.$client.end();
}

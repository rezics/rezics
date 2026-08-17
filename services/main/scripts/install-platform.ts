import { parsePlatformInstallCommandOptions } from "../src/services/bootstrap/command-options";
import { platformInstallationService } from "../src/services/bootstrap/service";
import { database } from "../src/services/database";

try {
	const options = parsePlatformInstallCommandOptions(process.argv.slice(2));
	const result = await platformInstallationService.install(options);
	if (result.status === "already_installed") {
		console.info("Platform installation is already complete; no data was changed.");
	} else if (options.credentialOutput === "suppress") {
		console.info(
			`Platform installation completed; ${result.issuedCredentials.length} initial credentials were intentionally suppressed.`,
		);
	} else {
		console.info(
			"Platform installation completed. Store these initial credentials now; they will not be shown again.",
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

import { parsePlatformCredentialRotationCommand } from "../src/services/bootstrap/command-options";
import { rotatePlatformCredentials } from "../src/services/bootstrap/credential-service";
import { database } from "../src/services/database";

try {
	parsePlatformCredentialRotationCommand(process.argv.slice(2));
	const issuedCredentials = await rotatePlatformCredentials();
	console.info(
		"Platform credentials were rotated. Store these passwords now; they will not be shown again.",
	);
	for (const credential of issuedCredentials) {
		console.info(
			`\n${credential.name} (${credential.action})\nEmail: ${credential.email}\nPassword: ${credential.password}`,
		);
	}
} finally {
	await database.$client.end();
}

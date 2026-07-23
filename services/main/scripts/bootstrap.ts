import { parseBootstrapCredentialMode } from "../src/services/bootstrap/credentials";
import { bootstrapDatabase } from "../src/services/bootstrap/service";
import { database } from "../src/services/database";

try {
	const credentialMode = parseBootstrapCredentialMode(process.argv.slice(2));
	const result = await bootstrapDatabase({ credentialMode });
	if (result.issuedCredentials.length === 0) {
		console.info("Bootstrap is already complete; no credentials were changed.");
	} else {
		console.info(
			"Bootstrap Profile credentials were issued. Store these passwords now; they will not be shown again.",
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

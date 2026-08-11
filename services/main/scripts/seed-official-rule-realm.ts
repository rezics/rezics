import { database } from "../src/services/database";
import { parseOfficialRuleSeedOptions } from "../src/services/seed/official-rule-realm/contracts";
import { seedOfficialRuleRealm } from "../src/services/seed/official-rule-realm/service";

try {
	const result = await seedOfficialRuleRealm(parseOfficialRuleSeedOptions(process.argv.slice(2)));
	if (result.status === "already_seeded") {
		console.info(
			`Official Rule Realm already has online revision ${result.revisionId}; no data was changed.`,
		);
	} else {
		console.info(
			`Official Rule Realm initial revision ${result.revisionId} (version ${result.version}) was published.`,
		);
	}
} finally {
	await database.$client.end();
}

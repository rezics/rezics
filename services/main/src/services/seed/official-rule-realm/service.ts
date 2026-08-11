import { OfficialRealmUnitIds } from "@rezics/slug";

import { recordAuditEvent } from "../../audit";
import { assertPlatformCoreReady, inspectPlatformCore } from "../../bootstrap/core";
import { OfficialProfileIds } from "../../bootstrap/manifest";
import { database } from "../../database";
import { publishRealmRuleRevision } from "../../realms/rule-publication";
import type { OfficialRuleSeedOptions } from "./contracts";
import { OfficialRuleInitialRevision } from "./initial-revision";

export type OfficialRuleSeedResult =
	| {
			readonly status: "seeded";
			readonly revisionId: string;
			readonly version: number;
	  }
	| {
			readonly status: "already_seeded";
			readonly revisionId: string;
	  };

/** Seeds only the first online revision; an existing Rule history is never reconciled. */
export async function seedOfficialRuleRealm(
	options: OfficialRuleSeedOptions,
): Promise<OfficialRuleSeedResult> {
	assertPlatformCoreReady(await inspectPlatformCore());
	return database.transaction(async (tx): Promise<OfficialRuleSeedResult> => {
		const result = await publishRealmRuleRevision(tx, {
			realmId: OfficialRealmUnitIds.rule,
			actorProfileId: OfficialProfileIds.community,
			baseRevisionId: null,
			...OfficialRuleInitialRevision,
		});
		if (result.status === "duplicate_localization")
			throw new Error(
				`Official Rule initial Seed has duplicate localizations at Rule ${result.ruleIndex}`,
			);
		if (result.status === "revision_changed") {
			if (options.whenSeeded === "skip" && result.currentRevisionId)
				return { status: "already_seeded", revisionId: result.currentRevisionId };
			throw new Error(
				`Official Rule Realm already has online revision ${result.currentRevisionId ?? "unknown"}`,
			);
		}
		await recordAuditEvent(tx, {
			category: "admin_activity",
			outcome: "succeeded",
			actor: { kind: "profile", profileId: OfficialProfileIds.community },
			authority: { kind: "realm", id: OfficialRealmUnitIds.rule },
			action: "realm.rules.initialize",
			target: { kind: "unit", id: OfficialRealmUnitIds.rule },
			details: { revisionId: result.revision.id, version: result.revision.version },
		});
		return {
			status: "seeded",
			revisionId: result.revision.id,
			version: result.revision.version,
		};
	});
}

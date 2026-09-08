import type { DatabaseTransaction } from "../database";
import {
	readCatalogSourceApplication,
	type CatalogSourceNativeChange,
} from "./source-applications";
import type { CatalogSourceNativeWriter } from "./source-proposals";
import { compensateCatalogSourceOwnedChange } from "./source-owned-compensation";
import { MusicComponentChangeSchema } from "./music-structure-contracts";
import { compensateMusicComponents } from "./music-structure";
import { loadCatalogIdentity, recordCatalogChange } from "./storage";
import { compensateCatalogProfileSourceChange } from "./profile-source";

/** @internal Every music mapper uses the same exact source journal compensation protocol. */
export async function compensateMusicSourceApplication(
	tx: DatabaseTransaction,
	context: Parameters<CatalogSourceNativeWriter>[1],
) {
	const application = await readCatalogSourceApplication(tx, context.actor, {
		sourceRecordId: context.sourceRecordId,
		proposalId: context.proposalId,
		action: "apply",
	});
	if (!application) throw new Error("Source application has no native compensation journal");
	const inverse: CatalogSourceNativeChange[] = [];
	for (const change of [...application.changes].reverse()) {
		if (change.kind === "music-component") continue;
		if (
			!("owner" in change) ||
			change.owner !== context.reference.owner ||
			change.ownerId !== context.reference.id
		)
			throw new TypeError("Music compensation targets another native owner");
		if (change.kind === "catalog-profile")
			inverse.push(await compensateCatalogProfileSourceChange(tx, context.actor, change));
		else if (
			change.kind === "catalog-name" ||
			change.kind === "catalog-name-authority" ||
			change.kind === "catalog-semantic" ||
			change.kind === "catalog-identifier"
		)
			inverse.push(await compensateCatalogSourceOwnedChange(tx, context.actor, change));
		else
			throw new TypeError("MusicBrainz compensation contains an unsupported native journal family");
	}
	const changes = application.changes
		.filter((change) => change.kind === "music-component")
		.map((change) => {
			if (context.reference.owner !== "music" || change.ownerId !== context.reference.id)
				throw new TypeError("Music compensation journal targets another owner");
			return MusicComponentChangeSchema.parse({
				component: change.component,
				componentKey: change.componentKey,
				beforeRevisionId: change.beforeRevisionId,
				afterRevisionId: change.afterRevisionId,
			});
		});
	const current = await loadCatalogIdentity(tx, context.reference, context.actor, true);
	const result = changes.length
		? await compensateMusicComponents(
				tx,
				context.reference,
				context.actor,
				current.revision,
				changes,
			)
		: {
				revision: await recordCatalogChange(
					tx,
					context.reference,
					context.actor,
					current.revision,
					"music.source.withdraw",
				),
				changes: [],
			};
	return {
		revision: result.revision,
		changes: [
			...inverse,
			...result.changes.map((change) => ({
				kind: "music-component" as const,
				ownerId: context.reference.id,
				...change,
			})),
		],
	};
}

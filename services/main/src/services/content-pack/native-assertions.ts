import { putPublishingComponent } from "../catalog/publishing-components";
import { appendSoftwareReleaseComponents } from "../catalog/software";
import { createGroupingOrderProfile, orderGroupingRelation } from "../catalog/grouping";
import { CatalogReferenceSchema, type CatalogReference } from "@rezics/reference";
import type { DatabaseTransaction } from "../database";
import {
	ensureCatalogDefinition,
	loadCatalogIdentity,
	beginCatalogFact,
	appendCatalogFactNodes,
	sealCatalogFact,
	createCatalogRelation,
} from "../catalog/storage";
import { catalogValueNodes, type CatalogValueNode } from "../catalog/value-nodes";
import type { LoadedPack } from "./contracts";
import { ContentPackInvalid } from "./errors";

/** Authored typed facts and object relations share the normal revisioned native write path. */
export async function importNativePackAssertions(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	actor: string,
): Promise<void> {
	const byKey = new Map(pack.objects.map((object) => [object.sourceKey, object]));
	function reference(key: string): CatalogReference {
		const object = byKey.get(key);
		if (!object) throw new ContentPackInvalid(`Missing native assertion owner ${key}`);
		return CatalogReferenceSchema.parse({ owner: object.identity.owner, id: pack.ids.units[key] });
	}
	const orderProfiles = new Map<string, string>();
	const facts = new Map<string, { id: string; owner: CatalogReference }>();
	for (const fact of pack.relations.catalogFacts ?? []) {
		if (facts.has(fact.sourceKey)) throw new ContentPackInvalid("Duplicate native fact key");
		if (fact.definition.kind !== "property")
			throw new ContentPackInvalid("A native fact requires a property definition");
		const owner = reference(fact.ownerSourceKey),
			definition = await ensureCatalogDefinition(tx, fact.definition);
		const started = await beginCatalogFact(
			tx,
			owner,
			actor,
			(await loadCatalogIdentity(tx, owner, actor, true)).revision,
			definition.revisionId,
		);
		let revision = started.revision,
			last = -1,
			batch: CatalogValueNode[] = [];
		async function flush() {
			if (!batch.length) return;
			const appended = await appendCatalogFactNodes(
				tx,
				owner,
				actor,
				revision,
				started.id,
				last,
				batch,
			);
			revision = appended.revision;
			last = batch.at(-1)!.position;
			batch = [];
		}
		let bytes = 0;
		for (const node of catalogValueNodes(fact.value)) {
			const size = Buffer.byteLength(JSON.stringify(node));
			if (size > 500_000)
				throw new ContentPackInvalid("Native fact scalar exceeds command byte budget");
			if (batch.length === 128 || bytes + size > 500_000) {
				await flush();
				bytes = 0;
			}
			batch.push(node);
			bytes += size;
		}
		await flush();
		await sealCatalogFact(tx, owner, actor, revision, started.id, last);
		facts.set(fact.sourceKey, { id: started.id, owner });
	}
	for (const relation of pack.relations.catalogRelations ?? []) {
		if (relation.definition.kind !== "predicate" || relation.roleDefinition.kind !== "role")
			throw new ContentPackInvalid("Native relations require predicate and role definitions");
		const owner = reference(relation.sourceSourceKey),
			target = reference(relation.targetSourceKey),
			role = await ensureCatalogDefinition(tx, relation.roleDefinition);
		const qualifiers = [];
		for (const qualifier of relation.qualifiers) {
			const fact = facts.get(qualifier.factSourceKey);
			if (!fact || fact.owner.owner !== owner.owner || fact.owner.id !== owner.id)
				throw new ContentPackInvalid("Qualifier facts must belong to their relation owner");
			const qualifierDefinition = await ensureCatalogDefinition(tx, qualifier.definition);
			qualifiers.push({
				definitionRevisionId: qualifierDefinition.revisionId,
				valueFactId: fact.id,
			});
		}
		const targets = relation.roleDefinition.constraints.targets;
		if (!targets?.length || relation.definition.constraints.roles)
			throw new ContentPackInvalid(
				"Pack relations require explicit role targets; predicate role IDs are compiled from that declaration",
			);
		const qualifierRevisionIds = new Set(
			qualifiers.map((qualifier) => qualifier.definitionRevisionId),
		);
		for (const qualifier of relation.qualifierDefinitions) {
			if (qualifier.kind !== "property")
				throw new ContentPackInvalid("Qualifier definitions must be properties");
			qualifierRevisionIds.add((await ensureCatalogDefinition(tx, qualifier)).revisionId);
		}
		const definition = await ensureCatalogDefinition(tx, {
			...relation.definition,
			constraints: {
				...relation.definition.constraints,
				roles: [{ roleRevisionId: role.revisionId, min: 1, max: 1, targets }],
				qualifierRevisionIds: [...qualifierRevisionIds].sort(),
			},
		});
		const created = await createCatalogRelation(
			tx,
			owner,
			actor,
			(await loadCatalogIdentity(tx, owner, actor, true)).revision,
			{
				definitionRevisionId: definition.revisionId,
				participants: [{ roleRevisionId: role.revisionId, target }],
				qualifiers,
			},
		);
		if (relation.order) {
			if (owner.owner !== "grouping")
				throw new ContentPackInvalid("Only Grouping relationships have grouping order");
			const key = `${owner.id}:${relation.order.profileKey}`;
			let profileId = orderProfiles.get(key),
				revision = created.revision;
			if (!profileId) {
				const profile = await createGroupingOrderProfile(
					tx,
					owner,
					actor,
					revision,
					relation.order.profileKey,
				);
				profileId = profile.id;
				revision = profile.revision;
				orderProfiles.set(key, profileId);
			}
			await orderGroupingRelation(tx, owner, actor, revision, {
				profileId,
				relationId: created.id,
				position: relation.order.position,
				sourcePosition: relation.order.sourcePosition,
			});
		}
	}
	for (const component of pack.relations.publishingComponents ?? []) {
		const owner = reference(component.ownerSourceKey);
		await putPublishingComponent(
			tx,
			owner,
			actor,
			(await loadCatalogIdentity(tx, owner, actor, true)).revision,
			component.key,
			component.value,
		);
	}
	for (const component of pack.relations.softwareComponents ?? []) {
		const owner = reference(component.ownerSourceKey);
		await appendSoftwareReleaseComponents(
			tx,
			owner,
			actor,
			(await loadCatalogIdentity(tx, owner, actor, true)).revision,
			component.values,
		);
	}
}

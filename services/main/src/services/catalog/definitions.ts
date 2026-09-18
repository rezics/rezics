import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { catalogDefinition, catalogDefinitionRevision } from "@rezics/schema/postgres/catalog/identity";
import {
	CatalogDefinitionConstraintsSchema,
	type CatalogDefinitionConstraints,
} from "@rezics/schema/contracts/native/definition";
import type { CatalogValueNode } from "./value-nodes";

/** @alpha Validates exact immutable meaning before any native write. */
export async function assertCatalogDefinitionRevision(
	tx: DatabaseTransaction,
	id: string,
	kind:
		| "class"
		| "property"
		| "predicate"
		| "role"
		| "vocabulary"
		| readonly ("class" | "property" | "predicate" | "role" | "vocabulary")[],
) {
	z.uuid().parse(id);
	const [row] = await tx
		.select({
			id: catalogDefinitionRevision.id,
			definitionId: catalogDefinitionRevision.definitionId,
			version: catalogDefinitionRevision.version,
			valueKind: catalogDefinitionRevision.valueKind,
			constraints: catalogDefinitionRevision.constraints,
			kind: catalogDefinition.kind,
		})
		.from(catalogDefinitionRevision)
		.innerJoin(catalogDefinition, eq(catalogDefinition.id, catalogDefinitionRevision.definitionId))
		.where(
			and(
				eq(catalogDefinitionRevision.id, id),
				typeof kind === "string"
					? eq(catalogDefinition.kind, kind)
					: inArray(catalogDefinition.kind, [...kind]),
			),
		)
		.limit(1);
	if (!row) throw new TypeError("Definition revision has the wrong semantic kind or is missing");
	return { ...row, constraints: CatalogDefinitionConstraintsSchema.parse(row.constraints) };
}

/** @alpha A rule describes one scalar's meaning, independently of JSON representation. */
export function validateCatalogScalar(
	node: CatalogValueNode,
	rule: Pick<
		CatalogDefinitionConstraints,
		"nullable" | "integer" | "minimum" | "maximum" | "minLength" | "maxLength" | "allowedValues"
	>,
	expectedKind: string,
) {
	if (node.kind === "null" && rule.nullable) return;
	if (node.kind !== expectedKind) throw new TypeError("Value does not match the governed type");
	const value =
		node.kind === "string"
			? node.textValue
			: node.kind === "number"
				? Number(node.numberValue)
				: node.kind === "boolean"
					? node.booleanValue
					: null;
	if (
		node.kind === "number" &&
		(rule.minimum !== undefined || rule.maximum !== undefined || rule.integer || rule.allowedValues)
	) {
		if (
			typeof value !== "number" ||
			!Number.isFinite(value) ||
			(rule.integer && !Number.isSafeInteger(value)) ||
			(rule.minimum !== undefined && value < rule.minimum) ||
			(rule.maximum !== undefined && value > rule.maximum)
		)
			throw new TypeError("Value violates governed numeric constraints");
	}
	if (
		typeof value === "string" &&
		((rule.minLength !== undefined && [...value].length < rule.minLength) ||
			(rule.maxLength !== undefined && [...value].length > rule.maxLength))
	)
		throw new TypeError("Value violates governed text constraints");
	if (rule.allowedValues && !rule.allowedValues.some((allowed) => allowed === value))
		throw new TypeError("Value is not a governed vocabulary member");
}

/** @alpha Validate a bounded predicate command; each target belongs to the same participant as its role. */
export function validateCatalogParticipants(
	constraints: CatalogDefinitionConstraints,
	participants: readonly { roleRevisionId: string; target: { owner: string; shape: string } }[],
) {
	if (!constraints.roles?.length)
		throw new TypeError("Predicate has no governed participant roles");
	for (const participant of participants) {
		const role = constraints.roles.find((r) => r.roleRevisionId === participant.roleRevisionId);
		if (
			!role ||
			!role.targets.some(
				(t) => t.owner === participant.target.owner && t.shapes.includes(participant.target.shape),
			)
		)
			throw new TypeError("Participant role or target shape is not allowed by predicate");
	}
	for (const role of constraints.roles) {
		const count = participants.filter((p) => p.roleRevisionId === role.roleRevisionId).length;
		if (count < role.min || count > role.max)
			throw new TypeError("Predicate participant cardinality violated");
	}
}

/** @alpha Append a reviewed meaning without reinterpreting any prior fact or evidence. */
export async function validateCatalogDefinitionMeaning(
	tx: DatabaseTransaction,
	kind: typeof catalogDefinition.$inferSelect.kind,
	input: { valueKind: import("@rezics/schema/contracts/native/catalog").CatalogValueKind | null; constraints: z.input<typeof CatalogDefinitionConstraintsSchema> },
) {
	const constraints = CatalogDefinitionConstraintsSchema.parse(input.constraints);
	if ((kind === "property") !== (input.valueKind !== null))
		throw new TypeError("Definition kind and value type disagree");
	if (kind === "predicate" && !constraints.roles?.length)
		throw new TypeError("Predicate requires governed roles");
	if (kind !== "predicate" && (constraints.roles || constraints.qualifierRevisionIds))
		throw new TypeError("Only predicates declare participant roles and relation qualifiers");
	if (kind === "property" && ["object", "array"].includes(input.valueKind ?? "") && !constraints.rules)
		throw new TypeError("Structured property requires governed rules");
	if (constraints.rules && (kind !== "property" || constraints.rules[0]?.kind !== input.valueKind))
		throw new TypeError("Property grammar must start with its governed value kind");
	const groups = [
		{ ids: (constraints.roles ?? []).map(role => role.roleRevisionId), kinds: ["role"] },
		{ ids: constraints.qualifierRevisionIds ?? [], kinds: ["property"] },
		{ ids: constraints.memberRevisionIds ?? [], kinds: ["class", "vocabulary"] },
		{ ids: [constraints.vocabularyRevisionId, ...(constraints.rules ?? []).map(rule => rule.vocabularyRevisionId)]
			.filter((id): id is string => id !== undefined), kinds: ["vocabulary"] },
	] satisfies { ids: string[]; kinds: (typeof catalogDefinition.$inferSelect.kind)[] }[];
	for (const { ids, kinds } of groups) {
		const unique = [...new Set(ids)];
		if (!unique.length) continue;
		const rows = await tx.select({ id: catalogDefinitionRevision.id }).from(catalogDefinitionRevision)
			.innerJoin(catalogDefinition, eq(catalogDefinition.id, catalogDefinitionRevision.definitionId))
			.where(and(inArray(catalogDefinitionRevision.id, unique), inArray(catalogDefinition.kind, kinds)))
			.limit(unique.length);
		if (rows.length !== unique.length) throw new TypeError("Definition dependency is missing or has another semantic kind");
	}
	return constraints;
}

/** @alpha Append a reviewed meaning without reinterpreting any prior fact or evidence. */
export async function reviseCatalogDefinition(
	tx: DatabaseTransaction,
	definitionId: string,
	expectedVersion: number,
	input: {
		valueKind: import("@rezics/schema/contracts/native/catalog").CatalogValueKind | null;
		constraints: z.input<typeof CatalogDefinitionConstraintsSchema>;
	},
) {
	z.uuid().parse(definitionId);
	z.number()
		.int()
		.positive()
		.max(Number.MAX_SAFE_INTEGER - 1)
		.parse(expectedVersion);
	const [identity] = await tx
		.select()
		.from(catalogDefinition)
		.where(eq(catalogDefinition.id, definitionId))
		.limit(1)
		.for("update");
	if (!identity) throw new TypeError("Definition is missing");
	const [latest] = await tx
		.select()
		.from(catalogDefinitionRevision)
		.where(eq(catalogDefinitionRevision.definitionId, definitionId))
		.orderBy(desc(catalogDefinitionRevision.version))
		.limit(1);
	if (latest?.version !== expectedVersion) throw new TypeError("Definition head changed");
	const constraints = await validateCatalogDefinitionMeaning(tx, identity.kind, input);
	const [revision] = await tx
		.insert(catalogDefinitionRevision)
		.values({ definitionId, version: expectedVersion + 1, valueKind: input.valueKind, constraints })
		.returning();
	if (!revision) throw new Error("Definition revision was not inserted");
	return revision;
}

/** @alpha A class or vocabulary is applicable only to its declared native shapes and semantic slot. */
export async function assertCatalogDefinitionTarget(
	tx: DatabaseTransaction,
	id: string,
	kind: Parameters<typeof assertCatalogDefinitionRevision>[2],
	target: { owner: string; shape: string },
	slot?: string,
) {
	const definition = await assertCatalogDefinitionRevision(tx, id, kind);
	if (
		!definition.constraints.targets?.some(
			(t) => t.owner === target.owner && t.shapes.includes(target.shape),
		) ||
		(slot !== undefined && !definition.constraints.slots?.includes(slot))
	)
		throw new TypeError("Definition is outside its governed target or slot scope");
	return definition;
}

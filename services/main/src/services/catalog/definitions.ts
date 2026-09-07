import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { catalogDefinition, catalogDefinitionRevision } from "../database/schema/catalog-identity";
import {
	CatalogDefinitionConstraintsSchema,
	type CatalogDefinitionConstraints,
} from "./definition-contracts";
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
export async function reviseCatalogDefinition(
	tx: DatabaseTransaction,
	definitionId: string,
	expectedVersion: number,
	input: {
		valueKind: import("./contracts").CatalogValueKind | null;
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
	const constraints = CatalogDefinitionConstraintsSchema.parse(input.constraints);
	if ((identity.kind === "property") !== (input.valueKind !== null))
		throw new TypeError("Definition kind and value type disagree");
	if (identity.kind === "predicate" && !constraints.roles?.length)
		throw new TypeError("Predicate requires governed roles");
	if (
		identity.kind === "property" &&
		["object", "array"].includes(input.valueKind ?? "") &&
		!constraints.rules
	)
		throw new TypeError("Structured property requires governed rules");
	for (const role of constraints.roles ?? [])
		await assertCatalogDefinitionRevision(tx, role.roleRevisionId, "role");
	for (const qualifier of constraints.qualifierRevisionIds ?? [])
		await assertCatalogDefinitionRevision(tx, qualifier, "property");
	for (const member of constraints.memberRevisionIds ?? [])
		await assertCatalogDefinitionRevision(tx, member, ["class", "vocabulary"]);
	for (const vocabulary of new Set(
		[
			constraints.vocabularyRevisionId,
			...(constraints.rules ?? []).map((r) => r.vocabularyRevisionId),
		].filter((id): id is string => id !== undefined),
	))
		await assertCatalogDefinitionRevision(tx, vocabulary, "vocabulary");
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

import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	uniqueIndex,
	uuid,
	type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { CatalogOwnerValues, type CatalogOwner } from "@rezics/reference";
import { pgTable } from "./base";
import { createUuidv7PrimaryKey } from "./columns";
import { CatalogNameTables } from "./catalog-names";
import {
	RevisionReferenceKindValues,
	type RevisionReferenceKind,
	type CatalogRevisionReference,
} from "../../units/revision-reference-contract";

const KindSuffix = {
	named_form: "NamedForm",
	identifier_claim: "IdentifierClaim",
} as const satisfies Record<RevisionReferenceKind, string>;
type Prefix = `${CatalogOwner}${(typeof KindSuffix)[RevisionReferenceKind]}`;
type UuidKey = `${Prefix}OwnerId` | `${Prefix}ItemId`;
type RevisionKey = `${Prefix}Revision`;
const revisionColumn = () => bigint({ mode: "number" });
type Builders = Record<UuidKey, ReturnType<typeof uuid>> &
	Record<RevisionKey, ReturnType<typeof revisionColumn>>;
type Values = Record<UuidKey, string | null> & Record<RevisionKey, number | null>;
type Columns = Record<UuidKey | RevisionKey, AnyPgColumn>;

/** Code-owned column keys for one complete revision alternative. @internal */
export function revisionReferenceFields(owner: CatalogOwner, kind: RevisionReferenceKind) {
	const prefix = `${owner}${KindSuffix[kind]}` as const;
	return {
		ownerId: `${prefix}OwnerId`,
		itemId: `${prefix}ItemId`,
		revision: `${prefix}Revision`,
	} as const;
}

function columns(): Builders {
	const entries = CatalogOwnerValues.flatMap((owner) =>
		RevisionReferenceKindValues.flatMap((kind) => {
			const fields = revisionReferenceFields(owner, kind);
			return [
				[fields.ownerId, uuid()],
				[fields.itemId, uuid()],
				[fields.revision, revisionColumn()],
			] as const;
		}),
	);
	if (
		new Set(entries.map(([key]) => key)).size !==
		CatalogOwnerValues.length * RevisionReferenceKindValues.length * 3
	)
		throw new Error("Revision reference columns collide");
	// The closed owner/family registry constructs every declared key with its matching scalar builder.
	return Object.fromEntries(entries) as Builders;
}

/** Encode an already validated target into one complete alternative. @internal */
export function revisionReferenceValues(target: CatalogRevisionReference): Values {
	const entries = CatalogOwnerValues.flatMap((owner) =>
		RevisionReferenceKindValues.flatMap((kind) => {
			const fields = revisionReferenceFields(owner, kind);
			const selected = owner === target.owner && kind === target.kind;
			return [
				[fields.ownerId, selected ? target.ownerId : null],
				[fields.itemId, selected ? target.itemId : null],
				[fields.revision, selected ? target.revision : null],
			] as const;
		}),
	);
	// The same finite key constructor preserves UUID versus revision-number field types.
	return Object.fromEntries(entries) as Values;
}

/** The complete ordered FK tuple for one revision alternative. @internal */
export function revisionReferenceTargetColumns(
	owner: CatalogOwner,
	kind: RevisionReferenceKind,
	table: Columns,
) {
	const fields = revisionReferenceFields(owner, kind);
	return [table[fields.ownerId], table[fields.itemId], table[fields.revision]] as const;
}

/** Immutable exact values; parent identities are derived from concrete revision keys. @internal */
export const revisionReference = pgTable(
	"revision_reference",
	{ id: createUuidv7PrimaryKey(), ...columns() },
	(table) => {
		const alternatives = CatalogOwnerValues.flatMap((owner) =>
			RevisionReferenceKindValues.map((kind) => ({
				name: `${owner}_${kind}`,
				columns: revisionReferenceTargetColumns(owner, kind, table),
				target:
					kind === "named_form"
						? CatalogNameTables[owner].nameRevision
						: CatalogNameTables[owner].identifierRevision,
			})),
		);
		return [
			check(
				"revision_reference_target_check",
				sql`num_nonnulls(${sql.join(
					alternatives.map((alternative) => alternative.columns[0]),
					sql`, `,
				)}) = 1`,
			),
			...alternatives.flatMap(({ name, columns: keys, target }) => [
				check(
					`revision_reference_${name}_complete_check`,
					sql`num_nonnulls(${sql.join([...keys], sql`, `)}) = 0 or (num_nonnulls(${sql.join([...keys], sql`, `)}) = 3 and ${keys[2]} between 1 and 9007199254740991)`,
				),
				foreignKey({
					name: `revision_reference_${name}_fk`,
					columns: [...keys],
					foreignColumns: [target.ownerId, target.id, target.revision],
				}).onDelete("restrict"),
				uniqueIndex(`revision_reference_${name}_key`)
					.on(...keys)
					.where(sql`${keys[0]} is not null`),
			]),
		];
	},
);

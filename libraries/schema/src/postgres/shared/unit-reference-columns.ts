import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { check, index, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import {
	UnitOwnerValues,
	UnitReferenceSchema,
	type UnitOwner,
	type UnitReference,
} from "@rezics/reference";
import { CatalogIdentityTables } from "../catalog/identity";
import { audio, video } from "../media/media";
import { post } from "../forum/post";
import { poll } from "../forum/poll";
import { zone } from "../realms/zone";
import { realm, realmRule } from "../realms/realm";
import { customTheme } from "../realms/custom-theme";
import { collection } from "../community/collection";
import { tag } from "../knowledge/tag";
import { tagPath } from "../knowledge/tag-path";
import { label } from "../knowledge/label";

function suffixes() {
	return {
		publishing: "Publishing",
		music: "Music",
		program: "Program",
		software: "Software",
		entity: "Entity",
		grouping: "Grouping",
		reference: "Reference",
		distribution: "Distribution",
		video: "Video",
		audio: "Audio",
		post: "Post",
		poll: "Poll",
		zone: "Zone",
		realm: "Realm",
		realm_rule: "RealmRule",
		custom_theme: "CustomTheme",
		collection: "Collection",
		tag: "Tag",
		tag_path: "TagPath",
		label: "Label",
	} as const satisfies Record<UnitOwner, string>;
}
type Key<
	Prefix extends string,
	Owner extends UnitOwner,
> = `${Prefix}${ReturnType<typeof suffixes>[Owner]}Id`;
type Builders<Prefix extends string> = {
	[Owner in UnitOwner as Key<Prefix, Owner>]: ReturnType<typeof uuid>;
};
type Values<Prefix extends string> = { [Owner in UnitOwner as Key<Prefix, Owner>]: string | null };
type Columns<Prefix extends string> = Record<Key<Prefix, UnitOwner>, AnyPgColumn>;

/** Select a concrete reference column using the closed physical-owner registry. @internal */
export function unitReferenceTargetColumn<Prefix extends string>(
	prefix: Prefix,
	owner: UnitOwner,
	columns: Columns<Prefix>,
): AnyPgColumn {
	return columns[key(prefix, owner)];
}

function key<Prefix extends string, Owner extends UnitOwner>(prefix: Prefix, owner: Owner) {
	return `${prefix}${suffixes()[owner]}Id` as const;
}
function physical(prefix: string, owner: UnitOwner) {
	if (!/^[a-z][A-Za-z]*$/u.test(prefix))
		throw new TypeError("Unit reference prefixes must be code-owned camel-case identifiers");
	return `${prefix.replace(/[A-Z]/gu, (letter) => `_${letter.toLowerCase()}`)}_${owner}_id`;
}
function name(value: string) {
	value = value.replace(/[A-Z]/gu, (letter) => `_${letter.toLowerCase()}`);
	return value.length <= 63
		? value
		: `${value.slice(0, 52)}_${createHash("sha256").update(value).digest("hex").slice(0, 10)}`;
}

/** The registered physical owner key, never a locator or universal identity parent. */
export function unitOwnerTable(owner: UnitOwner) {
	switch (owner) {
		case "publishing":
		case "music":
		case "program":
		case "software":
		case "entity":
		case "grouping":
		case "reference":
		case "distribution":
			return CatalogIdentityTables[owner];
		case "audio":
			return audio;
		case "video":
			return video;
		case "post":
			return post;
		case "poll":
			return poll;
		case "zone":
			return zone;
		case "realm":
			return realm;
		case "realm_rule":
			return realmRule;
		case "custom_theme":
			return customTheme;
		case "collection":
			return collection;
		case "tag":
			return tag;
		case "tag_path":
			return tagPath;
		case "label":
			return label;
	}
}
export function unitOwnerIdColumn(owner: UnitOwner): AnyPgColumn {
	return unitOwnerTable(owner).id;
}

/** Concrete nullable alternatives; derived logical ID/owner columns are not independent writable references. @internal */
export function unitReferenceColumns<Prefix extends string>(
	prefix: Prefix,
	onDelete: "restrict" | "cascade" | "set null" = "restrict",
): Builders<Prefix> {
	const entries = UnitOwnerValues.map(
		(owner) =>
			[
				key(prefix, owner),
				uuid(physical(prefix, owner)).references(() => unitOwnerIdColumn(owner), { onDelete }),
			] as const,
	);
	if (new Set(entries.map(([key]) => key)).size !== UnitOwnerValues.length)
		throw new Error("Unit reference column identities collide");
	// The closed registry and shared key constructor establish every mapped property; external values never select columns.
	return Object.fromEntries(entries) as Builders<Prefix>;
}

export function unitReferenceValues<Prefix extends string>(
	prefix: Prefix,
	input: UnitReference,
): Values<Prefix> {
	const reference = UnitReferenceSchema.parse(input);
	return Object.fromEntries(
		UnitOwnerValues.map((owner) => [
			key(prefix, owner),
			reference.owner === owner ? reference.id : null,
		]),
	) as Values<Prefix>;
}

export function unitReferenceIdExpression<Prefix extends string>(
	prefix: Prefix,
	columns?: Columns<Prefix>,
) {
	return sql`coalesce(${sql.join(
		UnitOwnerValues.map((owner) =>
			columns ? columns[key(prefix, owner)] : sql.identifier(physical(prefix, owner)),
		),
		sql`, `,
	)})`;
}
export function unitReferenceOwnerExpression<Prefix extends string>(
	prefix: Prefix,
	columns?: Columns<Prefix>,
) {
	return sql`case ${sql.join(
		UnitOwnerValues.map(
			(owner) =>
				sql`when ${columns ? columns[key(prefix, owner)] : sql.identifier(physical(prefix, owner))} is not null then ${sql.raw(`'${owner}'`)}`,
		),
		sql` `,
	)} else null end`;
}

/** Every alternative has a selective reverse index so native deletion/maintenance never scans the consumer corpus. */
export function unitReferenceConstraints<Prefix extends string>(
	tableName: string,
	prefix: Prefix,
	columns: Columns<Prefix>,
	optional = false,
	idColumn?: AnyPgColumn,
) {
	const ordered = UnitOwnerValues.map((owner) => columns[key(prefix, owner)]);
	return [
		check(
			name(`${tableName}_${prefix}_target_check`),
			sql`num_nonnulls(${sql.join(ordered, sql`, `)}) ${optional ? sql`between 0 and 1` : sql`= 1`}`,
		),
		...(idColumn
			? [
					check(
						name(`${tableName}_${prefix}_id_check`),
						sql`${idColumn} is not distinct from ${unitReferenceIdExpression(prefix)}`,
					),
				]
			: []),
		...UnitOwnerValues.map((owner) => {
			const column = columns[key(prefix, owner)];
			return index(name(`${tableName}_${prefix}_${owner}_ref_idx`))
				.on(column)
				.where(sql`${column} is not null`);
		}),
	];
}

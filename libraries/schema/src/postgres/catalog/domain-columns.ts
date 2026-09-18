import { sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	check,
	foreignKey,
	integer,
	smallint,
	text,
	uuid,
} from "drizzle-orm/pg-core";
import type { CatalogOwner } from "../../contracts/native/catalog";
import { CatalogIdentityTables } from "./identity";

/** A structural role is enforced separately from arbitrary semantic classification. */
export function catalogSubtypeColumns<const Shape extends string>(shape: Shape) {
	return { id: uuid().primaryKey(), identityShape: text().$type<Shape>().default(shape).notNull() };
}

export function catalogSubtypeConstraints(
	name: string,
	owner: CatalogOwner,
	shape: string,
	table: { id: AnyPgColumn; identityShape: AnyPgColumn },
) {
	const identity = CatalogIdentityTables[owner];
	return [
		foreignKey({
			name: `${name}_identity_fk`,
			columns: [table.id, table.identityShape],
			foreignColumns: [identity.id, identity.shape],
		}).onDelete("restrict"),
		check(`${name}_shape_check`, sql`${table.identityShape} = ${shape}`),
	];
}

export function catalogDateColumns() {
	return { dateYear: integer(), dateMonth: smallint(), dateDay: smallint(), dateText: text() };
}

export function catalogDateConstraint(
	name: string,
	table: { dateYear: AnyPgColumn; dateMonth: AnyPgColumn; dateDay: AnyPgColumn },
) {
	return check(
		name,
		sql`
		(${table.dateMonth} is null or ${table.dateMonth} between 1 and 12)
		and (${table.dateDay} is null or ${table.dateDay} between 1 and 31)
		and (${table.dateMonth} is null or ${table.dateDay} is null or ${table.dateDay} <= case
			when ${table.dateMonth} in (4, 6, 9, 11) then 30
			when ${table.dateMonth} = 2 then case when ${table.dateYear} is null
				or mod(${table.dateYear}, 400) = 0 or (mod(${table.dateYear}, 4) = 0 and mod(${table.dateYear}, 100) <> 0) then 29 else 28 end
			else 31 end)`,
	);
}

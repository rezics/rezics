import type { StorageModule } from "@rezics/schema/model/contracts";
const identifier = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const quoted = (value: string) => JSON.stringify(value);
const snake = (value: string) => value.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
/** @alpha Emit real Drizzle declarations from authored storage decisions, never source-provider DDL or a database introspection snapshot. */
export function emitDrizzle(module: StorageModule): string {
	const builders = new Set<string>(["pgTable"]),
		lines: string[] = [];
	const name = (value: string) =>
		value.includes("$family")
			? "`" + value.replaceAll("$family", "${prefix}") + "`"
			: quoted(value);
	if (module.factory)
		lines.push(
			`export function ${module.factory.name}(prefix: string) {`,
			`if (!/^[a-z][a-z0-9_]{0,30}$/.test(prefix)) throw new TypeError("Invalid relation family");`,
		);
	const field = (name: string) => {
		if (!identifier.test(name)) throw new TypeError(`Invalid model identifier: ${name}`);
		return name;
	};
	const expression = (value: string, table = "t") =>
		"sql`" +
		value
			.replaceAll("`", "\\`")
			.replaceAll("${", "\\${")
			.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (_, name) => `\${${table}.${field(name)}}`) +
		"`";
	const columns = (values: string[], table = "t") =>
		values
			.map((value) =>
				value.endsWith(":desc")
					? `${table}.${field(value.slice(0, -5))}.desc()`
					: `${table}.${field(value)}`,
			)
			.join(", ");
	const declared = new Set(module.tables.map((table) => table.symbol));
	for (const table of module.tables) {
		field(table.symbol);
		if (!/^[a-z][a-z0-9_]{0,62}$/.test(table.name.replace("$family", "family")))
			throw new TypeError(`Invalid physical table: ${table.name}`);
		if (!table.decision || !table.meaning || !table.sourceTerms.length)
			throw new TypeError(
				`A storage model requires reviewed meaning and source terms: ${table.name}`,
			);
		if (
			new Set(Object.entries(table.columns).map(([key, column]) => column.name ?? snake(key)))
				.size !== Object.keys(table.columns).length
		)
			throw new TypeError(`Duplicate physical column in ${table.name}`);
		lines.push(
			`/** ${table.meaning.replaceAll("*/", "* /")} @alpha */`,
			`${module.factory ? "" : "export "}const ${table.symbol} = pgTable(${name(table.name)}, {`,
		);
		for (const [key, column] of Object.entries(table.columns)) {
			field(key);
			const kind = column.type;
			builders.add(kind === "bytes" ? "customType" : kind);
			const args =
				kind === "bigint"
					? `, { mode: "number" }`
					: kind === "timestamp"
						? `, { withTimezone: true, ${column.precision === undefined ? "" : `precision: ${column.precision}, `}mode: "date" }`
						: "";
			let declaration = `${kind}(${quoted(column.name ?? snake(key))}${args})`;
			if (column.typeScript) declaration += `.$type<${column.typeScript}>()`;
			if (column.primary) declaration += ".primaryKey()";
			else if (column.required) declaration += ".notNull()";
			if (column.defaultSql) declaration += `.default(sql\`${column.defaultSql}\`)`;
			if (column.reference) {
				field(column.reference.table);
				field(column.reference.column);
				declaration += `.references((): AnyPgColumn => ${column.reference.table}.${column.reference.column})`;
			}
			lines.push(`\t${key}: ${declaration},`);
		}
		lines.push("}, (t) => [");
		for (const rule of table.constraints) {
			if ("columns" in rule)
				for (const column of rule.columns)
					if (!table.columns[column.replace(/:desc$/, "")])
						throw new TypeError(`Unknown model field ${table.name}.${column}`);
			if (rule.kind === "check") {
				builders.add("check");
				for (const name of rule.expression.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g))
					if (!table.columns[name[1]!]) throw new TypeError(`Unknown check field ${name[1]}`);
				lines.push(`\tcheck(${name(rule.name)}, ${expression(rule.expression)}),`);
			} else if (rule.kind === "index") {
				builders.add("index");
				lines.push(
					`\tindex(${name(rule.name)}).on(${[columns(rule.columns), ...(rule.expressions ?? []).map((value) => expression(value))].filter(Boolean).join(", ")})${rule.where ? `.where(${expression(rule.where)})` : ""},`,
				);
			} else if (rule.kind === "unique") {
				builders.add("unique");
				lines.push(`\tunique(${rule.name ? name(rule.name) : ""}).on(${columns(rule.columns)}),`);
			} else if (rule.kind === "primary") {
				builders.add("primaryKey");
				lines.push(
					`\tprimaryKey({${rule.name ? `name: ${name(rule.name)}, ` : ""}columns: [${columns(rule.columns)}]}),`,
				);
			} else if (rule.kind === "foreign") {
				builders.add("foreignKey");
				field(rule.table);
				if (rule.columns.length !== rule.target.length)
					throw new TypeError("Foreign-key arity differs");
				if (declared.has(rule.table))
					for (const name of rule.target)
						if (!module.tables.find((table) => table.symbol === rule.table)!.columns[name])
							throw new TypeError(`Unknown foreign key field ${rule.table}.${name}`);
				const target = rule.table === table.symbol ? "t" : rule.table;
				lines.push(
					`\tforeignKey({${rule.name ? `name: ${name(rule.name)}, ` : ""}columns: [${columns(rule.columns)}], foreignColumns: [${columns(rule.target, target)}]})${rule.onDelete ? `.onDelete(${quoted(rule.onDelete)})` : ""}${rule.onUpdate ? `.onUpdate(${quoted(rule.onUpdate)})` : ""},`,
				);
			}
		}
		lines.push("]);", "");
	}
	if (module.factory) {
		lines.push(`return { ${module.tables.map((table) => table.symbol).join(", ")} };`, "}");
		module.factory.instances.forEach((instance, i) => {
			lines.push(`const family${i} = ${module.factory!.name}(${quoted(instance.argument)});`);
			for (const [symbol, key] of Object.entries(instance.exports))
				lines.push(`export const ${symbol} = family${i}.${field(key)};`);
		});
	}
	const imports = [
		"// Generated by task libraries:schema-importer:generate from reviewed model declarations. Do not edit.",
		`import { sql } from "drizzle-orm";`,
		`import { ${[...builders].sort().join(", ")}${module.tables.some((table) => Object.values(table.columns).some((column) => column.reference)) ? ", type AnyPgColumn" : ""} } from "drizzle-orm/pg-core";`,
	];
	for (const [path, symbols] of Object.entries(module.typeImports ?? {}))
		imports.push(`import type { ${symbols.join(", ")} } from ${quoted(path)};`);
	for (const [path, symbols] of Object.entries(module.tableImports ?? {}))
		imports.push(`import { ${symbols.join(", ")} } from ${quoted(path)};`);
	if (builders.has("customType"))
		imports.push(
			'const bytes = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });',
		);
	return [...imports, "", ...lines].join("\n");
}

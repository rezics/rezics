import { splitSqlColumns } from "./provider-contracts";

/** @alpha Lex top-level SQL words without confusing quoted defaults or nested expressions with constraints. */
export function sqlDeclarationTokens(text: string) {
	const tokens: { word: string; start: number; end: number }[] = [];
	let depth = 0,
		quote: string | null = null;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i]!;
		if (quote) {
			if (ch === quote) {
				if (text[i + 1] === quote) i++;
				else quote = null;
			}
			continue;
		}
		if (ch === "'" || ch === '"') {
			quote = ch;
			continue;
		}
		if (ch === "(") {
			depth++;
			continue;
		}
		if (ch === ")") {
			depth--;
			continue;
		}
		if (depth === 0 && /[A-Za-z_]/.test(ch)) {
			const start = i;
			while (i + 1 < text.length && /[A-Za-z0-9_]/.test(text[i + 1]!)) i++;
			tokens.push({ word: text.slice(start, i + 1).toUpperCase(), start, end: i + 1 });
		}
	}
	return tokens;
}

/** @alpha Complete table declarations and composite key clauses; this parser never executes upstream SQL. */
export function readPostgresDeclarations(tableSql: string, keySql: string[]) {
	const tables = new Map<
		string,
		{
			columns: Map<
				string,
				{ declaration: string; nullable: boolean; defaultExpression: string | null }
			>;
			clauses: unknown[];
		}
	>();
	for (const statement of splitSqlColumns(tableSql, ";")) {
		const declaration = statement.replace(
			/\s+PARTITION BY\s+(?:LIST|RANGE|HASH)\s*\([^()]*\)\s*$/u,
			"",
		);
		const match = /^CREATE TABLE\s+([a-z_][a-z_0-9]*)\s*\((.*)\)$/su.exec(declaration);
		if (!match) continue;
		const table = {
			columns: new Map<
				string,
				{ declaration: string; nullable: boolean; defaultExpression: string | null }
			>(),
			clauses: [] as unknown[],
		};
		for (const declaration of splitSqlColumns(match[2]!)) {
			const name = /^([a-z_][a-z_0-9]*)\s+/u.exec(declaration)?.[1];
			if (!name) {
				table.clauses.push({ kind: "table-constraint", declaration });
				continue;
			}
			const tokens = sqlDeclarationTokens(declaration),
				where = tokens.findIndex((token) => token.word === "DEFAULT");
			const end =
				where < 0
					? undefined
					: tokens
							.slice(where + 1)
							.find(
								(token, i) =>
									["CONSTRAINT", "CHECK", "REFERENCES", "UNIQUE", "PRIMARY"].includes(token.word) ||
									(token.word === "NOT" && tokens[where + 2 + i]?.word === "NULL"),
							)?.start;
			const nullable = !tokens.some(
				(token, i) => token.word === "NOT" && tokens[i + 1]?.word === "NULL",
			);
			table.columns.set(name, {
				declaration,
				nullable,
				defaultExpression: where < 0 ? null : declaration.slice(tokens[where]!.end, end).trim(),
			});
		}
		tables.set(match[1]!, table);
	}
	for (const source of keySql)
		for (const statement of splitSqlColumns(source, ";")) {
			const match =
				/^ALTER TABLE\s+([a-z_0-9]+)\s+ADD CONSTRAINT\s+([a-z_0-9]+)\s+(PRIMARY KEY|FOREIGN KEY|UNIQUE)\s*\(([^)]+)\)([\s\S]*)$/u.exec(
					statement,
				);
			if (!match) continue;
			const table = tables.get(match[1]!);
			if (!table) throw new TypeError(`Key references an unknown table: ${match[1]}`);
			const columns = match[4]!.split(",").map((value) => value.trim()),
				reference = /REFERENCES\s+([a-z_0-9]+)\s*\(([^)]+)\)/u.exec(match[5]!);
			table.clauses.push({
				kind: match[3],
				name: match[2],
				columns,
				target: reference
					? { table: reference[1], columns: reference[2]!.split(",").map((value) => value.trim()) }
					: null,
				declaration: statement,
			});
			if (match[3] === "PRIMARY KEY")
				for (const column of columns) {
					const entry = table.columns.get(column);
					if (!entry) throw new TypeError("Key column is missing");
					entry.nullable = false;
				}
		}
	return tables;
}

import { z } from "zod";
import { VndbHierarchyEdgeSchema, VndbSemanticObjectSchema } from "./vndb-semantics-contracts";

const dumpObject = z.record(z.string(), z.unknown());
const dumpAlias = z.string().max(131_072);
const dumpParents = z.array(VndbHierarchyEdgeSchema).max(512);

/**
 * @alpha Converts one selected public dump row into a validated semantic object.
 * @remarks The importer retains the original row for archival evidence. This projection
 * accepts at most 512 parent edges and aliases, never traverses ancestors, and maps
 * normalized pointers back to the original dump columns. Private/cache columns stay
 * outside native projections. The public SQL columns are defined by VNDB's schema.sql.
 */
export function normalizeVndbSemanticDump(
	objectType: z.infer<typeof VndbSemanticObjectSchema>["objectType"],
	input: unknown,
): {
	record: z.infer<typeof VndbSemanticObjectSchema>;
	sourcePath: (path: string) => string;
	parents: z.infer<typeof VndbHierarchyEdgeSchema>[];
} {
	const raw = dumpObject.parse(input);
	if (raw.objectType !== undefined && raw.objectType !== objectType)
		throw new TypeError("VNDB dump object family does not match the selected family");
	const selected: Record<string, unknown> = { objectType, id: raw.id };
	const select = (fields: readonly string[]) => {
		for (const field of fields) if (Object.hasOwn(raw, field)) selected[field] = raw[field];
	};
	switch (objectType) {
		case "tag":
		case "trait":
			select(["name", "description", "searchable", "applicable", "defaultspoil"]);
			if (raw.alias !== undefined) {
				const aliases = dumpAlias.parse(raw.alias);
				selected.aliases = aliases === "" ? [] : aliases.split("\n");
			}
			if (objectType === "tag") selected.category = raw.cat;
			else {
				select(["sexual", "gorder"]);
				selected.group_id = raw.gid;
			}
			break;
		case "quote":
			select(["quote", "score"]);
			selected.vn = { id: raw.vid };
			if (raw.cid !== undefined) selected.character = raw.cid === null ? null : { id: raw.cid };
			break;
		case "drm":
			select([
				"name",
				"description",
				"disc",
				"cdkey",
				"activate",
				"alimit",
				"account",
				"online",
				"cloud",
				"physical",
			]);
			break;
		case "engine":
			select(["name", "description"]);
			break;
	}
	const record = VndbSemanticObjectSchema.parse(selected);
	const parents = dumpParents.parse(raw.parents === undefined ? [] : raw.parents);
	const parentIds = new Set<string>();
	for (const edge of parents) {
		if ((objectType !== "tag" && objectType !== "trait") || edge.id !== record.id)
			throw new TypeError("VNDB dump parent edge does not belong to the selected object");
		if (parentIds.has(edge.parent)) throw new TypeError("Duplicate VNDB dump parent edge");
		parentIds.add(edge.parent);
	}
	return {
		record,
		parents,
		sourcePath: (path) => {
			if (objectType === "tag" || objectType === "trait") {
				if (path === "/aliases" || /^\/aliases\/(?:0|[1-9]\d*)$/u.test(path)) return "/alias";
				if (objectType === "tag" && path === "/category") return "/cat";
				if (objectType === "trait" && path === "/group_id") return "/gid";
			}
			if (objectType === "quote") {
				if (path === "/vn" || path === "/vn/id") return "/vid";
				if (path === "/character" || path === "/character/id") return "/cid";
			}
			return path;
		},
	};
}

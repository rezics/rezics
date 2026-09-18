import { z } from "zod";
import { schemaId, digest, stableJson } from "@rezics/schema/identity";

/** @alpha IIIF presentation records preserve ordered occurrences; Canvas identity never becomes binary identity. */
export function convertIiif(input: unknown) {
	const root = z.record(z.string(), z.unknown()).parse(input),
		rootId = z.string().url().parse(root.id);
	const nodes: {
		id: string;
		iri: string | null;
		type: string | null;
		path: string;
		raw: unknown;
	}[] = [];
	const occurrences: {
		id: string;
		parentId: string;
		nodeId: string;
		property: string;
		position: number;
	}[] = [];
	const walk = (value: unknown, path: string, depth: number): string => {
		if (depth > 128 || nodes.length > 100_000)
			throw new RangeError("IIIF document budget exceeded");
		const record = z.record(z.string(), z.unknown()).parse(value);
		const iri = typeof record.id === "string" ? record.id : null;
		const id = schemaId("iiif-node", rootId, path);
		nodes.push({
			id,
			iri,
			type: typeof record.type === "string" ? record.type : null,
			path,
			raw: record,
		});
		for (const key of [
			"items",
			"annotations",
			"structures",
			"partOf",
			"seeAlso",
			"rendering",
			"service",
			"services",
			"body",
			"target",
			"selector",
			"source",
			"thumbnail",
		]) {
			if (record[key] === undefined) continue;
			const values = Array.isArray(record[key]) ? record[key] : [record[key]];
			values.forEach((child, position) => {
				if (typeof child === "string") child = { id: child };
				if (child === null || typeof child !== "object" || Array.isArray(child))
					throw new TypeError(`Invalid IIIF ${key} node`);
				const nodeId = walk(child, `${path}/${key}/${position}`, depth + 1);
				occurrences.push({
					id: schemaId("iiif-occurrence", id, key, String(position)),
					parentId: id,
					nodeId,
					property: key,
					position,
				});
			});
		}
		return id;
	};
	return {
		id: walk(root, "#", 0),
		iri: rootId,
		nodes,
		occurrences,
		raw: root,
		digest: digest(stableJson(root)),
	};
}

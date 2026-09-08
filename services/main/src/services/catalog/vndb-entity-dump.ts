import { z } from "zod";
import { VndbStaffSchema, VndbProducerSchema } from "./vndb-entities";
import {
	VndbDumpExternalBindingSchema,
	VndbDumpExternalLinkSchema,
	planVndbDumpExternalLinks,
} from "./vndb-dump-media";

const staffId = z.string().regex(/^s[1-9][0-9]*$/u);
const producerId = z.string().regex(/^p[1-9][0-9]*$/u);
const integer = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const name = z.string().min(1).max(131072);
const links = {
	extlinks: z.array(VndbDumpExternalLinkSchema).max(1024),
	links: z.array(VndbDumpExternalBindingSchema).max(1024),
};
export const VndbStaffDumpSchema = z.object({
	staff: z.object({
		id: staffId,
		gender: z.enum(["", "m", "f"]),
		lang: z.string(),
		main: integer,
		description: z.string().max(524288),
		prod: producerId.nullable(),
	}),
	aliases: z
		.array(z.object({ id: staffId, aid: integer, name, latin: name.nullable() }))
		.min(1)
		.max(1024),
	...links,
});
export const VndbProducerDumpSchema = z.object({
	producer: z.object({
		id: producerId,
		type: z.enum(["co", "in", "ng"]),
		lang: z.string(),
		name,
		latin: name.nullable(),
		alias: z.string().max(131072),
		description: z.string().max(524288),
	}),
	relations: z
		.array(
			z.object({
				id: producerId,
				pid: producerId,
				relation: z.enum(["old", "new", "sub", "par", "imp", "ipa", "spa", "ori"]),
			}),
		)
		.max(1024),
	...links,
});

/** @alpha Bounded public dump packets retain exact join-row evidence; absent private stype never classifies an Entity. */
export function normalizeVndbEntityDump(kind: "staff" | "producer", input: unknown) {
	if (kind === "staff") {
		const packet = VndbStaffDumpSchema.parse(input),
			row = packet.staff;
		if (packet.aliases.some((alias) => alias.id !== row.id))
			throw new TypeError("Staff alias belongs to another source owner");
		const index = packet.aliases.findIndex((alias) => alias.aid === row.main),
			main = packet.aliases[index];
		if (!main) throw new TypeError("Main staff alias join is missing");
		const record = VndbStaffSchema.parse({
			...row,
			aid: main.aid,
			ismain: true,
			name: main.latin ?? main.name,
			original: main.latin ? main.name : null,
			gender: row.gender || null,
			aliases: packet.aliases.map((alias) => ({ ...alias, ismain: alias.aid === row.main })),
		});
		const extraSemantics = planVndbDumpExternalLinks(
			row.id,
			packet.links,
			packet.extlinks,
			"/links",
		);
		if (row.prod !== null)
			extraSemantics.relations.push({
				key: "has-linked-producer-profile",
				path: "/staff/prod",
				spoiler: 0,
				qualifiers: [],
				participants: [
					{
						role: "producer",
						target: {
							owner: "entity",
							shape: "unresolved",
							objectType: "producer",
							externalId: row.prod,
							path: "/staff/prod",
						},
					},
				],
			});
		return {
			record,
			extraSemantics,
			sourcePath: (path: string) => {
				if (path === "/") return "/staff";
				if (path === "/name") return `/aliases/${index}/${main.latin ? "latin" : "name"}`;
				if (path === "/original") return `/aliases/${index}/name`;
				if (path.startsWith("/aliases/")) return path;
				return `/staff${path}`;
			},
		};
	}
	const packet = VndbProducerDumpSchema.parse(input),
		row = packet.producer;
	const targets = new Set<string>();
	for (const relation of packet.relations) {
		if (relation.id !== row.id || relation.pid === row.id || targets.has(relation.pid))
			throw new TypeError("Producer relation join is duplicate or differs from its owner");
		targets.add(relation.pid);
	}
	const record = VndbProducerSchema.parse({
		...row,
		name: row.latin ?? row.name,
		original: row.latin ? row.name : null,
		aliases: row.alias === "" ? [] : row.alias.split("\n"),
		relations: packet.relations.map((relation) => ({
			id: relation.pid,
			relation: relation.relation,
		})),
	});
	return {
		record,
		extraSemantics: planVndbDumpExternalLinks(row.id, packet.links, packet.extlinks, "/links"),
		sourcePath: (path: string) => {
			if (path === "/") return "/producer";
			if (path === "/name") return `/producer/${row.latin ? "latin" : "name"}`;
			if (path === "/original") return "/producer/name";
			if (path.startsWith("/aliases/")) return "/producer/alias";
			if (path.startsWith("/relations/")) return path.replace(/\/id$/u, "/pid");
			return `/producer${path}`;
		},
	};
}

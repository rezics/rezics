import { z } from "zod";
import { BangumiSubjectContractSha256, BangumiSubjectSchema } from "./bangumi";
import { BangumiApiContractSha256 } from "./bangumi-adoption";
import {
	BangumiApiRelationSchemas,
	BangumiCharacterSchema,
	BangumiEpisodeSchema,
	BangumiIndexSchema,
	BangumiIndexSubjectPageSchema,
	BangumiPersonSchema,
	BangumiRevisionSchema,
	BangumiRevisionPageSchema,
} from "./bangumi-records";

const id = z.string().regex(/^[1-9][0-9]*$/u);
const recordSchemas = {
	person: BangumiPersonSchema,
	character: BangumiCharacterSchema,
	episode: BangumiEpisodeSchema,
	index: BangumiIndexSchema,
};
const recordPaths = {
	person: "persons",
	character: "characters",
	episode: "episodes",
	index: "indices",
} as const;
const relationPaths = {
	subject_persons: ["subjects", "persons"],
	subject_characters: ["subjects", "characters"],
	subject_subjects: ["subjects", "subjects"],
	person_subjects: ["persons", "subjects"],
	person_characters: ["persons", "characters"],
	character_persons: ["characters", "persons"],
	character_subjects: ["characters", "subjects"],
} as const;

/** Fixed public endpoints and explicit bounded page identities, never arbitrary request URLs. @internal */
export function bangumiAcquisitionDescriptor(objectType: string, externalId: string) {
	if (objectType === "subject") {
		id.parse(externalId);
		return {
			url: `https://api.bgm.tv/v0/subjects/${externalId}`,
			method: "GET" as const,
			contractSha256: BangumiSubjectContractSha256,
			authoritativeGone: true,
			parse(raw: unknown) {
				const record = BangumiSubjectSchema.parse(raw);
				if (String(record.id) !== externalId)
					throw new TypeError("Bangumi subject identity differs");
				return record;
			},
		};
	}
	const principal = z.enum(["person", "character", "episode", "index"]).safeParse(objectType);
	if (principal.success) {
		id.parse(externalId);
		const type = principal.data;
		return {
			url: `https://api.bgm.tv/v0/${recordPaths[type]}/${externalId}`,
			method: "GET" as const,
			contractSha256: BangumiApiContractSha256,
			authoritativeGone: true,
			parse(raw: unknown) {
				const record = recordSchemas[type].parse(raw);
				if (String(record.id) !== externalId)
					throw new TypeError("Bangumi object identity differs");
				return record;
			},
		};
	}
	const relation = z
		.enum([
			"subject_persons",
			"subject_characters",
			"subject_subjects",
			"person_subjects",
			"person_characters",
			"character_persons",
			"character_subjects",
		])
		.safeParse(objectType);
	if (relation.success) {
		id.parse(externalId);
		const type = relation.data;
		const [parent, target] = relationPaths[type];
		return {
			url: `https://api.bgm.tv/v0/${parent}/${externalId}/${target}`,
			method: "GET" as const,
			contractSha256: BangumiApiContractSha256,
			authoritativeGone: false,
			parse: (raw: unknown) => z.array(BangumiApiRelationSchemas[type]).parse(raw),
		};
	}
	if (objectType === "index_subjects") {
		const scope = z
			.string()
			.regex(/^([1-9][0-9]*):(0|[1-9][0-9]*)$/u)
			.parse(externalId)
			.split(":");
		const offset = z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).parse(scope[1]);
		return {
			url: `https://api.bgm.tv/v0/indices/${scope[0]}/subjects?limit=50&offset=${offset}`,
			method: "GET" as const,
			contractSha256: BangumiApiContractSha256,
			authoritativeGone: false,
			parse(raw: unknown) {
				const page = BangumiIndexSubjectPageSchema.parse(raw);
				if (page.offset !== offset || page.limit !== 50)
					throw new TypeError("Bangumi index page differs from admitted scope");
				return page;
			},
		};
	}
	const revisions = z
		.enum(["subject_revisions", "person_revisions", "character_revisions"])
		.safeParse(objectType);
	if (revisions.success) {
		const scope = z
			.string()
			.regex(/^([1-9][0-9]*):(0|[1-9][0-9]*)$/u)
			.parse(externalId)
			.split(":");
		const offset = z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).parse(scope[1]);
		const parent = revisions.data.slice(0, -"_revisions".length);
		return {
			url: `https://api.bgm.tv/v0/revisions/${parent}s?${parent}_id=${scope[0]}&limit=50&offset=${offset}`,
			method: "GET" as const,
			contractSha256: BangumiApiContractSha256,
			authoritativeGone: false,
			parse(raw: unknown) {
				const page = BangumiRevisionPageSchema.parse(raw);
				if (page.offset !== offset || page.limit !== 50)
					throw new TypeError("Bangumi revision page differs from admitted scope");
				return page;
			},
		};
	}
	const revision = z
		.enum(["subject_revision", "person_revision", "character_revision"])
		.safeParse(objectType);
	if (revision.success) {
		id.parse(externalId);
		const target =
			revision.data === "subject_revision"
				? "subjects"
				: revision.data === "person_revision"
					? "persons"
					: "characters";
		return {
			url: `https://api.bgm.tv/v0/revisions/${target}/${externalId}`,
			method: "GET" as const,
			contractSha256: BangumiApiContractSha256,
			authoritativeGone: false,
			parse(raw: unknown) {
				const value = BangumiRevisionSchema.parse(raw);
				if (String(value.id) !== externalId)
					throw new TypeError("Bangumi revision identity differs");
				return value;
			},
		};
	}
	throw new TypeError("No reviewed Bangumi acquisition family");
}

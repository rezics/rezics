import { z } from "zod";
import { VndbCatalogContractSha256, VndbVnSchema, VndbReleaseSchema } from "./vndb";
import { VndbStaffSchema, VndbProducerSchema, VndbCharacterSchema } from "./vndb-entities";
import { VndbSemanticFieldsSchema, VndbSemanticObjectSchema } from "./vndb-semantics-contracts";

export const VndbAcquisitionObjectTypeSchema = z.enum([
	"vn",
	"release",
	"staff",
	"producer",
	"character",
	"tag",
	"trait",
	"quote",
]);
export type VndbAcquisitionObjectType = z.infer<typeof VndbAcquisitionObjectTypeSchema>;
const prefixes = {
	vn: "v",
	release: "r",
	staff: "s",
	producer: "p",
	character: "c",
	tag: "g",
	trait: "i",
	quote: "q",
} as const;
const image = "id,url,dims,sexual,violence,votecount";
const fullImage = `${image},thumbnail,thumbnail_dims`;
const links = "id,name,label,url";
/** All principal scalar fields and edge qualifiers; related principals are separately acquired by identity. */
export const VndbAcquisitionFields = {
	vn: `id,title,alttitle,titles{lang,title,latin,official,main},aliases,olang,description,devstatus,released,platforms,languages,length,length_minutes,length_votes,average,rating,popularity,votecount,image{${fullImage}},screenshots{${fullImage},release.id},relations{id,relation,relation_official},tags{id,rating,spoiler,lie},developers.id,editions{eid,lang,name,official},staff{id,aid,name,original,eid,role,note},va{staff{id,aid,name,original},character.id,note},extlinks{${links}}`,
	release: `id,title,alttitle,languages{lang,title,latin,main,mtl},platforms,media{medium,qty},vns{id,rtype},producers{id,developer,publisher},images{${fullImage},type,vn,languages,photo},released,minage,patch,freeware,uncensored,official,has_ero,resolution,engine,voiced,notes,gtin,catalog,extlinks{${links}}`,
	staff: `id,name,original,aid,ismain,lang,gender,description,aliases{aid,name,latin,ismain},extlinks{${links}}`,
	producer: `id,name,original,aliases,lang,type,description,extlinks{${links}}`,
	character: `id,name,original,aliases,description,image{${image}},blood_type,height,weight,bust,waist,hips,cup,age,birthday,sex,gender,vns{id,role,spoiler,release.id},traits{id,spoiler,lie}`,
	tag: "id,name,aliases,description,category,searchable,applicable,vn_count",
	trait: "id,name,aliases,description,searchable,applicable,group_id,group_name,sexual,char_count",
	quote: "id,quote,score,vn.id,character.id",
} as const;

function parseRecord(type: VndbAcquisitionObjectType, raw: unknown) {
	switch (type) {
		case "vn": {
			const record = VndbVnSchema.parse(raw);
			VndbSemanticFieldsSchema.parse(record);
			return record;
		}
		case "release": {
			const record = VndbReleaseSchema.parse(raw);
			VndbSemanticFieldsSchema.parse(record);
			return record;
		}
		case "staff":
			return VndbStaffSchema.parse(raw);
		case "producer":
			return VndbProducerSchema.parse(raw);
		case "character":
			return VndbCharacterSchema.parse(raw);
		case "tag":
		case "trait":
		case "quote": {
			const value = z.record(z.string(), z.unknown()).parse(raw);
			const { objectType: _family, ...record } = VndbSemanticObjectSchema.parse({
				...value,
				objectType: type,
			});
			return record;
		}
	}
}

/** @internal Fixed VNDB endpoints only; shared runtime owns rate admission, deadlines, archive and authentication policy. */
export function vndbAcquisitionRequest(objectType: string, externalId: string) {
	const type = VndbAcquisitionObjectTypeSchema.parse(objectType);
	if (!new RegExp(`^${prefixes[type]}[1-9][0-9]*$`, "u").test(externalId))
		throw new TypeError("VNDB source identity does not match its endpoint family");
	return {
		url: `https://api.vndb.org/kana/${type}`,
		method: "POST" as const,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			filters:
				type === "staff"
					? ["and", ["id", "=", externalId], ["ismain", "=", 1]]
					: ["id", "=", externalId],
			fields: VndbAcquisitionFields[type],
			results: 1,
		}),
		contractSha256: VndbCatalogContractSha256,
		parse(raw: unknown) {
			const envelope = z
				.object({ results: z.array(z.unknown()).length(1), more: z.literal(false).optional() })
				.parse(raw);
			const record = parseRecord(type, envelope.results[0]);
			if (record.id !== externalId) throw new TypeError("VNDB returned another source identity");
			return record;
		},
	};
}

/** @internal Staff aliases are required dependencies for exact VN participation adoption. */
export function vndbRequiredStaffDependencies(input: unknown) {
	const record = VndbVnSchema.parse(input);
	return [
		...new Set([
			...(record.staff ?? []).map((item) => item.id),
			...(record.va ?? [])
				.filter((item) => item.staff.aid !== undefined)
				.map((item) => item.staff.id),
		]),
	].map((externalId) => ({ source: "vndb" as const, objectType: "staff" as const, externalId }));
}

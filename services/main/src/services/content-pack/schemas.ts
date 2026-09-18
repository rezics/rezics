import { CatalogIdentifierValuesSchema } from "@rezics/schema/contracts/native/names";
import { PublishingComponentValuesSchema } from "../catalog/publishing-components";
import { SoftwareReleaseComponentSchema } from "../catalog/software";
import {
	ZoneAppearanceDocument,
	isDocument,
	isPortableTextDocument,
	type PortableTextDocument,
	type ZoneAppearanceDocument as ZoneAppearanceDocumentValue,
} from "@rezics/block";
import {
	ContentLanguageChannelValues,
	MaximumContentLanguageSupportEntries,
	normalizeContentLanguageSupport,
} from "@rezics/content-language";
import { isLicenseId } from "@rezics/license";
import { CatalogOwnerValues, UnitOwnerValues } from "@rezics/reference";
import { SlugLabelPattern } from "@rezics/slug";
import { z } from "zod";
import { CatalogDefinitionInputSchema } from "@rezics/schema/contracts/native/catalog";
import { CreateCatalogResourceSchema } from "../catalog/resource-contracts";
import { nativePackReference } from "./native-contracts";

import {
	AiDisclosureValues,
	AliasKindValues,
	ContentLanguageValues,
	ContentRatingValues,
	ContentStatusValues,
	ContentStructureKindValues,
	CreditAttributionRoleValues,
	ModerationStatusValues,
	PostKindValues,
	RealmJoinPolicyValues,
	RealmPageKindValues,
	ResourceVisibilityValues,
	SubjectAssociationRoleValues,
	UnitOwnershipModeValues,
	UnitStatusValues,
} from "@rezics/schema/postgres/shared/contract-values";
import {
	TagExpressionArgumentRoleValues,
	TagExpressionInferenceKindValues,
	TagExpressionKindValues,
	TagExpressionLabelComponentKindValues,
} from "@rezics/schema/postgres/knowledge/tag-expression";
import { TagRelationKindValues } from "@rezics/schema/postgres/knowledge/vocabulary";

const MaximumPostgresInteger = 2_147_483_647;
const ContentLanguageSupportOwnerValues = [
	"publishing",
	"music",
	"program",
	"software",
	"video",
	"audio",
] as const;

const NonEmptyString = z.string().refine((value) => value.trim().length > 0, {
	message: "Expected a non-blank string",
});
export const PackIdSchema = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,62})$/);
const Uuid = z.uuid();
const Timestamp = z.iso.datetime({ offset: true });
const CalendarDate = z.iso.date();
const Sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const Url = z.url().refine(
	(value) => {
		const url = new URL(value);
		return (
			(url.protocol === "https:" || url.protocol === "http:") &&
			url.username.length === 0 &&
			url.password.length === 0
		);
	},
	{ message: "Expected an absolute HTTP(S) URL without embedded credentials" },
);
const JsonValue = z.json();
// Provenance payloads are deliberately source-specific, but every nested value must be JSON.
const JsonObject = z.record(z.string(), JsonValue);
const PortableTextDocumentSchema = z.custom<PortableTextDocument>(isPortableTextDocument, {
	error: "Expected a Portable Text document",
});
const ZoneAppearanceDocumentSchema = z.custom<ZoneAppearanceDocumentValue>(
	(value): value is ZoneAppearanceDocumentValue => isDocument(ZoneAppearanceDocument, value),
	{ error: "Expected a ZoneAppearanceDocument" },
);
const SpoilerLevel = z.union([z.literal(0), z.literal(1), z.literal(2)]);
const FitVote = z.union([z.literal(-1), z.literal(1)]);
const PositivePostgresInteger = z.number().int().positive().max(MaximumPostgresInteger);
const NonNegativePostgresInteger = z.number().int().nonnegative().max(MaximumPostgresInteger);
const Slug = z.string().regex(SlugLabelPattern);

const ManifestAuxiliarySourceSchema = z
	.object({
		displayTitle: NonEmptyString,
		sha256: Sha256,
	})
	.strict();

export const PackManifestSchema = z
	.object({
		id: PackIdSchema,
		version: NonEmptyString,
		title: NonEmptyString.optional(),
		language: z.enum(ContentLanguageValues).optional(),
		languages: z.array(z.enum(ContentLanguageValues)).min(1).optional(),
		phase: NonEmptyString.optional(),
		minRezicsVersion: NonEmptyString.optional(),
		counts: z.record(NonEmptyString, NonNegativePostgresInteger).optional(),
		auxiliarySource: ManifestAuxiliarySourceSchema.optional(),
	})
	.strict()
	.superRefine((manifest, context) => {
		if (manifest.languages && new Set(manifest.languages).size !== manifest.languages.length)
			context.addIssue({
				code: "custom",
				path: ["languages"],
				message: "Manifest languages must be unique",
			});
	});

const IdBucket = z.record(NonEmptyString, Uuid);
export const IdLedgerSchema = z
	.object({
		units: IdBucket,
		structures: IdBucket.optional(),
		nodes: IdBucket.optional(),
		aliases: IdBucket.optional(),
		credits: IdBucket.optional(),
		subjects: IdBucket.optional(),
		guideNodes: IdBucket.optional(),
		tagRelations: IdBucket.optional(),
		tagExpressions: IdBucket.optional(),
		tagPaths: IdBucket.optional(),
		tagPathSenses: IdBucket.optional(),
	})
	.strict();

const FieldRightsSchema = z
	.object({
		path: z.string().regex(/^(?:\/(?:[^~/]|~[01])*)+$/, {
			message: "Field rights path must be a non-root RFC 6901 JSON Pointer",
		}),
		rightsBasis: NonEmptyString,
		verificationStatus: z.enum(["verified", "unverified"]),
		sourceUrl: Url,
		attributionText: NonEmptyString,
	})
	.strict();

export const RightsRecordsSchema = z
	.array(
		z
			.object({
				sourceKey: NonEmptyString,
				rightsBasis: NonEmptyString.optional(),
				jurisdiction: NonEmptyString.nullable().optional(),
				attributionText: z.string().nullable().optional(),
				payloadSha256: Sha256.optional(),
				fieldRights: z.array(FieldRightsSchema).min(1).optional(),
			})
			.strict()
			.superRefine((record, context) => {
				const paths = record.fieldRights?.map((field) => field.path) ?? [];
				if (new Set(paths).size !== paths.length)
					context.addIssue({
						code: "custom",
						path: ["fieldRights"],
						message: "Field-scoped rights paths must be unique within a rights record",
					});
			}),
	)
	.superRefine((records, context) => {
		const sourceKeys = records.map((record) => record.sourceKey);
		if (new Set(sourceKeys).size !== sourceKeys.length)
			context.addIssue({
				code: "custom",
				message: "A content object may have only one rights record",
			});
	});

const CitedSourceLockSchema = z
	.object({
		kind: z.literal("cited-sources"),
		retrievedOn: CalendarDate,
		sources: z
			.array(
				z
					.object({
						sourceId: NonEmptyString,
						url: Url,
						exportUrl: Url.optional(),
						title: NonEmptyString,
						role: NonEmptyString,
						retrievedAt: CalendarDate,
						sha256: Sha256.optional(),
						byteLength: z.number().int().positive().safe().optional(),
					})
					.strict(),
			)
			.min(1),
	})
	.strict();

const SourceRightsExceptionSchema = z
	.object({
		sourceField: NonEmptyString,
		rightsBasis: NonEmptyString,
		verificationStatus: z.enum(["verified", "unverified"]),
		sourceUrl: Url,
		notice: NonEmptyString,
	})
	.strict();

const SourceRightsExceptionsSchema = z
	.array(SourceRightsExceptionSchema)
	.min(1)
	.superRefine((exceptions, context) => {
		const sourceFields = exceptions.map((exception) => exception.sourceField);
		if (new Set(sourceFields).size !== sourceFields.length)
			context.addIssue({
				code: "custom",
				message: "Source rights exception fields must be unique",
			});
	});

const SourceAggregationSchema = z
	.object({
		name: NonEmptyString,
		sourceUrl: Url,
	})
	.strict();

const SnapshotProvenanceLockSchema = z
	.object({
		kind: z.literal("snapshot-provenance"),
		license: z
			.object({
				database: NonEmptyString,
				contents: NonEmptyString,
				sourceUrl: Url,
			})
			.strict(),
		attribution: NonEmptyString,
		sources: z
			.array(
				z
					.object({
						file: NonEmptyString,
						kind: z.enum(["html", "database-dump"]),
						url: Url,
						savedAt: Timestamp,
						sha256: Sha256,
					})
					.strict(),
			)
			.min(1),
		rightsExceptions: SourceRightsExceptionsSchema.optional(),
		aggregation: SourceAggregationSchema.optional(),
	})
	.strict();

const LocalEpubLockSchema = z
	.object({
		kind: z.literal("local-epub"),
		displayTitle: NonEmptyString,
		identifier: NonEmptyString,
		publisher: NonEmptyString,
		issuedOn: CalendarDate,
		creators: z.array(NonEmptyString).min(1),
		sha256: Sha256,
		byteLength: z.number().int().positive().safe(),
		role: NonEmptyString,
	})
	.strict();

export const SourceLockSchema = z.discriminatedUnion("kind", [
	CitedSourceLockSchema,
	SnapshotProvenanceLockSchema,
	LocalEpubLockSchema,
]);

export const PackBindingsSchema = z
	.array(
		z
			.object({
				sourceKey: NonEmptyString,
				epubHref: NonEmptyString,
				navPointId: z.string(),
			})
			.strict(),
	)
	.superRefine((bindings, context) => {
		const sourceKeys = bindings.map((binding) => binding.sourceKey);
		if (new Set(sourceKeys).size !== sourceKeys.length)
			context.addIssue({
				code: "custom",
				message: "Binding source keys must be unique",
			});
	});

const LocalizationSchema = z
	.object({
		language: z.enum(ContentLanguageValues),
		title: NonEmptyString,
		summary: z.string().optional(),
		description: PortableTextDocumentSchema.optional(),
		content: JsonValue.optional(),
		contentStatus: z.enum(ContentStatusValues).optional(),
	})
	.strict();

const ContentLanguageSupportSchema = z
	.array(
		z
			.object({
				languageTag: NonEmptyString,
				channels: z.array(z.enum(ContentLanguageChannelValues)).optional(),
			})
			.strict(),
	)
	.max(MaximumContentLanguageSupportEntries)
	.superRefine((support, context) => {
		try {
			normalizeContentLanguageSupport(support);
		} catch (error) {
			context.addIssue({
				code: "custom",
				message:
					error instanceof Error
						? `Invalid content language support: ${error.message}`
						: "Invalid content language support",
			});
		}
	});

const TagParentSourceKeysSchema = z
	.array(NonEmptyString)
	.max(16)
	.refine((parents) => new Set(parents).size === parents.length, {
		message: "Tag parent source keys must be distinct",
	});

const TagSchema = z.union([
	z.object({}).strict(),
	z
		.object({
			directlyApplicable: z.boolean(),
			defaultSpoilerLevel: SpoilerLevel.nullable(),
			sourceCategory: NonEmptyString.optional(),
			parentSourceKeys: TagParentSourceKeysSchema,
			primaryParentSourceKey: NonEmptyString.nullable(),
			sourceUrl: Url,
			sourceImportedAt: Timestamp,
		})
		.strict()
		.superRefine((record, context) => {
			const expectedPrimaryParent = record.parentSourceKeys[0] ?? null;
			if (record.primaryParentSourceKey !== expectedPrimaryParent)
				context.addIssue({
					code: "custom",
					path: ["primaryParentSourceKey"],
					message:
						"The primary Tag parent must be the first parent, or null when there are no parents",
				});
		}),
]);

const RealmPagesSchema = z
	.array(z.enum(RealmPageKindValues))
	.min(1)
	.max(RealmPageKindValues.length)
	.refine((pages) => new Set(pages).size === pages.length, {
		message: "Realm enabled pages must be unique",
	});

const PackObjectBaseSchema = z
	.object({
		sourceKey: NonEmptyString,
		identity: z
			.object({
				owner: z.enum(UnitOwnerValues),
				shape: z.string().regex(/^[a-z][a-z0-9_.-]{0,95}$/u),
				status: z.enum(UnitStatusValues),
				visibility: z.enum(ResourceVisibilityValues),
				contentRating: z.enum(ContentRatingValues),
				aiDisclosure: z.enum(AiDisclosureValues),
				license: z.custom(isLicenseId, { error: "Unknown license identifier" }).nullable(),
				moderationStatus: z.enum(ModerationStatusValues),
				postTargetingLocked: z.boolean(),
			})
			.strict(),
		import: z
			.object({
				ownershipMode: z.enum(UnitOwnershipModeValues),
				actorKind: z.literal("import"),
			})
			.strict(),
		contentLanguageSupport: ContentLanguageSupportSchema.optional(),
		native: CreateCatalogResourceSchema.optional(),
		nativeIdentifiers: z.array(CatalogIdentifierValuesSchema).max(128).optional(),
		groupingClasses: z.array(CatalogDefinitionInputSchema).max(128).optional(),
		tag: TagSchema.optional(),
		label: z.object({}).strict().optional(),
		collection: z.object({}).strict().optional(),
		video: z.object({ durationSeconds: PositivePostgresInteger.optional() }).strict().optional(),
		audio: z.object({ durationSeconds: PositivePostgresInteger.optional() }).strict().optional(),
		realm: z
			.object({
				slug: Slug,
				joinPolicy: z.enum(RealmJoinPolicyValues),
				realmTagVotingEnabled: z.boolean(),
				enabledPages: RealmPagesSchema,
			})
			.strict()
			.optional(),
		zone: z
			.object({
				slug: Slug,
				filterTagSourceKey: NonEmptyString.optional(),
				filterOwner: z.enum(["publishing", "program", "software", "music"]).optional(),
				themeAccent: NonEmptyString.optional(),
				homePageSourceKey: NonEmptyString.optional(),
				localRuleRealmSourceKey: NonEmptyString.optional(),
			})
			.strict()
			.optional(),
		compiledZone: z
			.object({
				slug: Slug,
				filterDocument: JsonValue,
				appearanceDocument: ZoneAppearanceDocumentSchema,
				localRuleRealmSourceKey: NonEmptyString,
			})
			.strict()
			.optional(),
		zonePage: z.object({ zoneSourceKey: NonEmptyString }).strict().optional(),
		post: z
			.object({ kind: z.enum(PostKindValues), subjectSourceKey: NonEmptyString.nullable() })
			.strict()
			.optional(),
		localizations: z.array(LocalizationSchema).min(1),
		aliases: z
			.array(
				z
					.object({
						sourceKey: NonEmptyString,
						term: NonEmptyString,
						normalizedTerm: NonEmptyString,
						language: z.enum(ContentLanguageValues).nullable(),
						kind: z.enum(AliasKindValues),
						pinned: z.boolean(),
					})
					.strict(),
			)
			.optional(),
		// These three redundant authored bindings are retained losslessly for xu-zhimo.
		labelSourceKey: NonEmptyString.optional(),
		structureSourceKey: NonEmptyString.optional(),
		creditRole: z.enum(CreditAttributionRoleValues).optional(),
	})
	.strict();

const PlatformDetailFields = [
	"tag",
	"label",
	"collection",
	"video",
	"audio",
	"realm",
	"zone",
	"compiledZone",
	"zonePage",
	"post",
] as const;
export const PackObjectSchema = PackObjectBaseSchema.superRefine((object, context) => {
	const issue = (path: (string | number)[], message: string) =>
		context.addIssue({ code: "custom", path, message });
	if (
		new Set(object.localizations.map((entry) => entry.language)).size !==
		object.localizations.length
	)
		issue(["localizations"], "Each language may occur only once");
	const catalog = CatalogOwnerValues.some((owner) => owner === object.identity.owner);
	if (object.groupingClasses && object.identity.owner !== "grouping")
		issue(["groupingClasses"], "Only a Grouping declares grouping classes");
	if (catalog) {
		if (!object.native)
			issue(["native"], "A catalog identity requires a complete native creation declaration");
		else {
			const expected = nativePackReference(object.native);
			if (expected.owner !== object.identity.owner || expected.shape !== object.identity.shape)
				issue(["identity"], "Native owner and shape must match the creation declaration");
		}
		for (const field of PlatformDetailFields)
			if (object[field] !== undefined)
				issue([field], "Platform detail is not valid on a catalog resource");
		if (object.identity.aiDisclosure !== "unknown" || object.identity.postTargetingLocked)
			issue(["identity"], "Catalog resources do not declare platform-only lifecycle fields");
	} else {
		if (object.native) issue(["native"], "A platform identity cannot declare a catalog structure");
		if (object.nativeIdentifiers || object.groupingClasses)
			issue([], "Catalog metadata is not valid on a platform resource");
		const expected =
			object.identity.owner === "zone"
				? ["zone", "compiledZone"]
				: object.identity.owner === "post"
					? ["post", ...(object.zonePage ? ["zonePage"] : [])]
					: [object.identity.owner];
		for (const field of PlatformDetailFields) {
			const required = expected.includes(field);
			if (required && object[field] === undefined && field !== "collection" && field !== "label")
				issue([field], "Missing platform detail");
			if (!required && object[field] !== undefined) issue([field], "Unexpected platform detail");
		}
		if (!PlatformDetailFields.some((field) => field === object.identity.owner))
			issue(["identity", "owner"], "This pack format does not support that platform owner");
		if (object.identity.shape !== (object.post?.kind ?? object.identity.owner))
			issue(["identity", "shape"], "Platform shape must match its concrete type");
		if (
			object.zonePage &&
			(object.identity.owner !== "post" ||
				object.post?.kind !== "page" ||
				object.post.subjectSourceKey !== object.zonePage.zoneSourceKey)
		)
			issue(["zonePage"], "A Zone Page is a page Post whose subject is its owning Zone");
	}
	if (!object.zonePage)
		for (const [index, localization] of object.localizations.entries())
			if (localization.content !== undefined && !isPortableTextDocument(localization.content))
				issue(["localizations", index, "content"], "Content must be a Portable Text document");
	if (
		object.contentLanguageSupport &&
		!ContentLanguageSupportOwnerValues.some((owner) => owner === object.identity.owner)
	)
		issue(["contentLanguageSupport"], "This owner does not support consumption languages");
	const bindings = [object.labelSourceKey, object.structureSourceKey, object.creditRole];
	const count = bindings.filter((value) => value !== undefined).length;
	if (
		count &&
		!(object.identity.owner === "publishing" && object.identity.shape === "text_version")
	)
		issue([], "Authored text bindings require a native TextVersion");
	if (count !== 0 && count !== bindings.length)
		issue([], "Authored text bindings must be declared together");
	if (object.zone && object.compiledZone && object.zone.slug !== object.compiledZone.slug)
		issue(["compiledZone", "slug"], "Zone slugs must match");
});

const ProvenanceFields = {
	sourceUrl: Url,
	sourceImportedAt: Timestamp,
} as const;

const SubjectRelationSchema = z
	.object({
		sourceKey: NonEmptyString,
		unitSourceKey: NonEmptyString,
		entitySourceKey: NonEmptyString,
		role: z.enum(SubjectAssociationRoleValues),
		contextPostSourceKey: NonEmptyString.nullable(),
		position: NonEmptyString,
		spoilerLevel: SpoilerLevel.optional(),
		sourceUrl: Url.optional(),
		sourceImportedAt: Timestamp.optional(),
	})
	.strict()
	.superRefine((relation, context) => {
		const evidenceFieldCount = [
			relation.spoilerLevel,
			relation.sourceUrl,
			relation.sourceImportedAt,
		].filter((value) => value !== undefined).length;
		if (evidenceFieldCount !== 0 && evidenceFieldCount !== 3)
			context.addIssue({
				code: "custom",
				message: "Subject spoiler evidence requires level, source URL, and import time together",
			});
	});

const UnitTagRelationSchema = z
	.object({
		unitSourceKey: NonEmptyString,
		tagSourceKey: NonEmptyString,
		pinned: z.boolean(),
		position: z.string().nullable(),
		fitVote: FitVote.optional(),
		spoilerLevel: SpoilerLevel.nullable().optional(),
		sourceUrl: Url.optional(),
		sourceImportedAt: Timestamp.optional(),
		sourceAggregate: JsonObject.nullable().optional(),
	})
	.strict()
	.superRefine((relation, context) => {
		if (relation.pinned !== (relation.position !== null))
			context.addIssue({
				code: "custom",
				message: "Pinned Tag applications require a position; unpinned applications forbid one",
			});
		const evidenceFieldCount = [
			relation.fitVote,
			relation.spoilerLevel,
			relation.sourceUrl,
			relation.sourceImportedAt,
			relation.sourceAggregate,
		].filter((value) => value !== undefined).length;
		if (evidenceFieldCount !== 0 && evidenceFieldCount !== 5)
			context.addIssue({
				code: "custom",
				message:
					"Importer Tag judgment evidence requires fit, spoiler, provenance, and aggregate fields together",
			});
	});

export const PackRelationsSchema = z
	.object({
		publishingComponents: z
			.array(
				z.strictObject({
					ownerSourceKey: NonEmptyString,
					key: Uuid,
					value: PublishingComponentValuesSchema,
				}),
			)
			.max(10000)
			.optional(),
		softwareComponents: z
			.array(
				z.strictObject({
					ownerSourceKey: NonEmptyString,
					values: z.array(SoftwareReleaseComponentSchema).min(1).max(128),
				}),
			)
			.max(10000)
			.optional(),
		catalogRelations: z
			.array(
				z.strictObject({
					sourceSourceKey: NonEmptyString,
					targetSourceKey: NonEmptyString,
					definition: CatalogDefinitionInputSchema,
					roleDefinition: CatalogDefinitionInputSchema,
					qualifierDefinitions: z.array(CatalogDefinitionInputSchema).max(64).default([]),
					order: z
						.strictObject({
							profileKey: NonEmptyString,
							position: NonEmptyString,
							sourcePosition: NonEmptyString.optional(),
						})
						.optional(),
					qualifiers: z
						.array(
							z.strictObject({
								factSourceKey: NonEmptyString,
								definition: CatalogDefinitionInputSchema,
							}),
						)
						.max(64)
						.default([]),
				}),
			)
			.max(10000)
			.optional(),
		catalogFacts: z
			.array(
				z.strictObject({
					sourceKey: NonEmptyString,
					ownerSourceKey: NonEmptyString,
					definition: CatalogDefinitionInputSchema,
					value: JsonValue,
					sourceEvidence: JsonObject.optional(),
				}),
			)
			.max(10000)
			.optional(),
		credits: z
			.array(
				z
					.object({
						sourceKey: NonEmptyString,
						sourceUnitSourceKey: NonEmptyString,
						creditedEntitySourceKey: NonEmptyString,
						role: z.enum(CreditAttributionRoleValues),
						position: NonEmptyString,
					})
					.strict(),
			)
			.optional(),
		subjects: z.array(SubjectRelationSchema).optional(),
		collectionItems: z
			.array(
				z
					.object({
						collectionSourceKey: NonEmptyString,
						unitSourceKey: NonEmptyString,
						position: NonEmptyString,
					})
					.strict(),
			)
			.optional(),
		unitTags: z.array(UnitTagRelationSchema).optional(),
		guideNodes: z
			.array(
				z
					.object({
						sourceKey: NonEmptyString,
						localizations: z
							.array(
								z
									.object({
										language: z.enum(ContentLanguageValues),
										title: NonEmptyString,
									})
									.strict(),
							)
							.min(1)
							.refine(
								(items) => new Set(items.map((item) => item.language)).size === items.length,
								{ message: "Guide-node localization languages must be unique" },
							),
						...ProvenanceFields,
					})
					.strict(),
			)
			.optional(),
		tagRelations: z
			.array(
				z
					.object({
						sourceKey: NonEmptyString,
						parentNodeSourceKey: NonEmptyString,
						childNodeSourceKey: NonEmptyString,
						relationKind: z.enum(TagRelationKindValues),
						...ProvenanceFields,
					})
					.strict(),
			)
			.optional(),
		tagExpressions: z
			.array(
				z
					.object({
						sourceKey: NonEmptyString,
						expressionKind: z.enum(TagExpressionKindValues),
						canonicalClaimKey: NonEmptyString.max(2048),
						focusTagSourceKey: NonEmptyString,
						arguments: z
							.array(
								z
									.object({
										role: z.enum(TagExpressionArgumentRoleValues),
										ordinal: NonNegativePostgresInteger,
										tagSourceKey: NonEmptyString,
									})
									.strict(),
							)
							.min(1)
							.refine(
								(items) =>
									new Set(items.map((item) => `${item.role}:${item.ordinal}`)).size ===
									items.length,
								{ message: "Expression argument role/ordinal pairs must be unique" },
							),
						labelComponents: z
							.array(
								z
									.object({
										tagSourceKey: NonEmptyString,
										semanticRole: z.enum(TagExpressionArgumentRoleValues),
										componentKind: z.enum(TagExpressionLabelComponentKindValues),
									})
									.strict(),
							)
							.min(1),
						groupKey: z
							.object({
								tagSourceKey: NonEmptyString,
								semanticRole: z.enum(TagExpressionArgumentRoleValues),
							})
							.strict()
							.nullable(),
						...ProvenanceFields,
					})
					.strict(),
			)
			.optional(),
		tagExpressionInferenceRules: z
			.array(
				z
					.object({
						sourceExpressionSourceKey: NonEmptyString,
						targetTagSourceKey: NonEmptyString.optional(),
						targetExpressionSourceKey: NonEmptyString.optional(),
						inferenceKind: z.enum(TagExpressionInferenceKindValues),
						...ProvenanceFields,
					})
					.strict()
					.refine(
						(rule) =>
							(rule.targetTagSourceKey === undefined) !==
							(rule.targetExpressionSourceKey === undefined),
						{ message: "An inference rule requires exactly one target" },
					),
			)
			.optional(),
		tagPaths: z
			.array(
				z
					.object({
						sourceKey: NonEmptyString,
						memberNodeSourceKeys: z
							.array(NonEmptyString)
							.min(2)
							.max(16)
							.refine((members) => new Set(members).size === members.length, {
								message: "A Tag Path cannot contain the same vocabulary node more than once",
							}),
						relationSourceKeys: z.array(NonEmptyString).min(1).max(15),
						...ProvenanceFields,
					})
					.strict()
					.refine(
						(path) => path.relationSourceKeys.length === path.memberNodeSourceKeys.length - 1,
						{ message: "A Tag Path needs one typed relation between every adjacent node" },
					),
			)
			.optional(),
		tagPathSenses: z
			.array(
				z
					.object({
						sourceKey: NonEmptyString,
						pathSourceKey: NonEmptyString,
						expressionSourceKey: NonEmptyString,
						bindings: z
							.array(
								z
									.object({
										memberOrdinal: NonNegativePostgresInteger,
										argumentRole: z.enum(TagExpressionArgumentRoleValues),
										argumentOrdinal: NonNegativePostgresInteger,
									})
									.strict(),
							)
							.min(1),
						...ProvenanceFields,
					})
					.strict(),
			)
			.optional(),
		tagPathApplications: z
			.array(
				z
					.object({
						unitSourceKey: NonEmptyString,
						senseSourceKey: NonEmptyString,
						fitVote: FitVote,
						spoilerLevel: SpoilerLevel.nullable(),
						...ProvenanceFields,
						sourceAggregate: JsonObject.nullable(),
					})
					.strict(),
			)
			.optional(),
		realmUnits: z
			.array(
				z
					.object({
						realmSourceKey: NonEmptyString,
						unitSourceKey: NonEmptyString,
						status: z.literal("visible"),
						publicationState: z.literal("active"),
					})
					.strict(),
			)
			.optional(),
		slugs: z
			.array(
				z
					.object({
						kind: z.literal("canonical"),
						scope: z.enum(["zones", "realms", "entities", "tags", "users"]),
						slug: Slug,
						targetSourceKey: NonEmptyString,
					})
					.strict(),
			)
			.optional(),
	})
	.strict();

const StructureNodeSchema = z
	.object({
		sourceKey: NonEmptyString,
		parentSourceKey: NonEmptyString.nullable(),
		contentUnitSourceKey: NonEmptyString,
		targetKind: z.enum(["content", "none", "unit"]),
		targetUnitSourceKey: NonEmptyString.optional(),
		position: NonEmptyString,
	})
	.strict()
	.superRefine((node, context) => {
		if (node.targetKind === "unit" && !node.targetUnitSourceKey)
			context.addIssue({
				code: "custom",
				path: ["targetUnitSourceKey"],
				message: "Unit targets require targetUnitSourceKey",
			});
		if (node.targetKind !== "unit" && node.targetUnitSourceKey)
			context.addIssue({
				code: "custom",
				path: ["targetUnitSourceKey"],
				message: `${node.targetKind} targets cannot declare targetUnitSourceKey`,
			});
	});

export const PackStructuresSchema = z.array(
	z
		.object({
			sourceKey: NonEmptyString,
			ownerUnitSourceKey: NonEmptyString,
			kind: z.enum(ContentStructureKindValues),
			nodes: z.array(StructureNodeSchema),
		})
		.strict()
		.superRefine((structure, context) => {
			if (
				(structure.kind === "zone.navigation" || structure.kind === "wiki.navigation") &&
				structure.nodes.some((node) => node.targetKind !== "unit")
			)
				context.addIssue({
					code: "custom",
					path: ["nodes"],
					message: "Navigation structures require Unit targets",
				});
		}),
);

export type PackManifest = z.infer<typeof PackManifestSchema>;
export type IdLedger = z.infer<typeof IdLedgerSchema>;
export type RightsRecord = z.infer<typeof RightsRecordsSchema>[number];
export type SourceLock = z.infer<typeof SourceLockSchema>;
export type PackBinding = z.infer<typeof PackBindingsSchema>[number];
export type PackContentLanguageSupportEntry = z.infer<typeof ContentLanguageSupportSchema>[number];
export type PackLocalization = z.infer<typeof LocalizationSchema>;
export type PackObject = z.infer<typeof PackObjectSchema>;
export type PackRelations = z.infer<typeof PackRelationsSchema>;
export type PackStructure = z.infer<typeof PackStructuresSchema>[number];

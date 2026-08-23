import { isPortableTextDocument, type PortableTextDocument } from "@rezics/block";
import {
	ContentLanguageChannelValues,
	MaximumContentLanguageSupportEntries,
	normalizeContentLanguageSupport,
} from "@rezics/content-language";
import { isLicenseId } from "@rezics/license";
import { SlugLabelPattern } from "@rezics/slug";
import { z } from "zod";

import {
	AiDisclosureValues,
	AliasKindValues,
	ContentLanguageValues,
	ContentRatingValues,
	ContentStatusValues,
	ContentStructureKindValues,
	CreditAttributionRoleValues,
	EntityKindValues,
	ModerationStatusValues,
	PostKindValues,
	RealmJoinPolicyValues,
	RealmPageKindValues,
	ResourceVisibilityValues,
	SubjectAssociationRoleValues,
	UnitOwnershipModeValues,
	UnitStatusValues,
	VariantCapableUnitKindValues,
	WorkReleaseStatusValues,
} from "../database/schema/contract-values";

const MaximumPostgresInteger = 2_147_483_647;
const PackUnitKindValues = [
	"book",
	"software",
	"media",
	"video",
	"audio",
	"release",
	"entity",
	"label",
	"tag",
	"series",
	"zone",
	"zone_page",
	"collection",
	"post",
	"realm",
] as const;
const ContentLanguageSupportUnitKindValues = [
	"book",
	"software",
	"media",
	"video",
	"audio",
	"release",
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
		tagPaths: IdBucket.optional(),
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
						title: NonEmptyString,
						role: NonEmptyString,
						retrievedAt: CalendarDate,
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

const EntityMeasurementSchema = z
	.object({
		contextUnitSourceKey: NonEmptyString.nullable(),
		heightMillimetres: PositivePostgresInteger.optional(),
		weightGrams: PositivePostgresInteger.optional(),
		bustMillimetres: PositivePostgresInteger.optional(),
		waistMillimetres: PositivePostgresInteger.optional(),
		hipsMillimetres: PositivePostgresInteger.optional(),
		sourceUrl: Url,
		sourceImportedAt: Timestamp,
		sourceProvenance: JsonObject,
	})
	.strict()
	.refine(
		(value) =>
			value.heightMillimetres !== undefined ||
			value.weightGrams !== undefined ||
			value.bustMillimetres !== undefined ||
			value.waistMillimetres !== undefined ||
			value.hipsMillimetres !== undefined,
		{ message: "A measurement row must contain at least one point value" },
	);

const EntityMeasurementsSchema = z
	.array(EntityMeasurementSchema)
	.max(9)
	.superRefine((measurements, context) => {
		const contexts = new Set<string | null>();
		for (const [index, measurement] of measurements.entries()) {
			if (contexts.has(measurement.contextUnitSourceKey))
				context.addIssue({
					code: "custom",
					path: [index, "contextUnitSourceKey"],
					message: "An Entity measurement context may appear only once",
				});
			contexts.add(measurement.contextUnitSourceKey);
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
		unit: z
			.object({
				kind: z.enum(PackUnitKindValues),
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
		entity: z
			.object({ kind: z.enum(EntityKindValues), verified: z.boolean() })
			.strict()
			.optional(),
		tag: TagSchema.optional(),
		label: z.object({}).strict().optional(),
		collection: z.object({}).strict().optional(),
		entityMeasurements: EntityMeasurementsSchema.optional(),
		book: z
			.object({
				releaseStatus: z.enum(WorkReleaseStatusValues),
				isbn13: z
					.string()
					.regex(/^\d{13}$/)
					.optional(),
				publicationDate: CalendarDate.optional(),
				pageCount: PositivePostgresInteger.optional(),
				wordCount: NonNegativePostgresInteger.optional(),
				format: NonEmptyString.optional(),
			})
			.strict()
			.optional(),
		media: z
			.object({
				kind: NonEmptyString,
				releaseStatus: z.enum(WorkReleaseStatusValues),
				releaseDate: CalendarDate.optional(),
				episodeCount: PositivePostgresInteger.optional(),
				seasonCount: PositivePostgresInteger.optional(),
				runtimeMinutes: PositivePostgresInteger.optional(),
			})
			.strict()
			.optional(),
		software: z
			.object({
				metadataOnly: z.boolean(),
				releaseDate: CalendarDate.optional(),
				versionLabel: NonEmptyString.optional(),
			})
			.strict()
			.optional(),
		release: z
			.object({
				parentUnitSourceKey: NonEmptyString,
				versionLabel: NonEmptyString,
				releasedOn: CalendarDate.optional(),
			})
			.strict()
			.optional(),
		video: z.object({ durationSeconds: PositivePostgresInteger.optional() }).strict().optional(),
		audio: z.object({ durationSeconds: PositivePostgresInteger.optional() }).strict().optional(),
		series: z.object({ kind: NonEmptyString }).strict().optional(),
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
				filterUnitKind: z.enum(["book", "media"]).optional(),
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
				themeDocument: JsonValue,
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

const DetailFields = [
	"entity",
	"tag",
	"label",
	"collection",
	"book",
	"media",
	"software",
	"release",
	"video",
	"audio",
	"series",
	"realm",
	"zone",
	"compiledZone",
	"zonePage",
	"post",
] as const;

const ExpectedDetailFields = {
	book: ["book"],
	software: ["software"],
	media: ["media"],
	video: ["video"],
	audio: ["audio"],
	release: ["release"],
	entity: ["entity"],
	label: ["label"],
	tag: ["tag"],
	series: ["series"],
	zone: ["zone", "compiledZone"],
	zone_page: ["zonePage", "post"],
	collection: [],
	post: ["post"],
	realm: ["realm"],
} as const satisfies Record<
	(typeof PackUnitKindValues)[number],
	readonly (typeof DetailFields)[number][]
>;

export const PackObjectSchema = PackObjectBaseSchema.superRefine((object, context) => {
	const localizationLanguages = object.localizations.map(({ language }) => language);
	if (new Set(localizationLanguages).size !== localizationLanguages.length)
		context.addIssue({
			code: "custom",
			path: ["localizations"],
			message: "A content object may declare each localization language only once",
		});
	const expected = new Set<(typeof DetailFields)[number]>(ExpectedDetailFields[object.unit.kind]);
	for (const field of DetailFields) {
		if (object.unit.kind === "collection" && field === "collection") continue;
		const present = object[field] !== undefined;
		if (expected.has(field) && !present)
			context.addIssue({
				code: "custom",
				path: [field],
				message: `${object.unit.kind} objects require ${field}`,
			});
		if (!expected.has(field) && present)
			context.addIssue({
				code: "custom",
				path: [field],
				message: `${field} is not valid on ${object.unit.kind} objects`,
			});
	}
	if (object.entityMeasurements && object.unit.kind !== "entity")
		context.addIssue({
			code: "custom",
			path: ["entityMeasurements"],
			message: "Only Entity objects may declare measurements",
		});
	if (object.unit.kind !== "zone_page")
		for (const [index, localization] of object.localizations.entries())
			if (localization.content !== undefined && !isPortableTextDocument(localization.content))
				context.addIssue({
					code: "custom",
					path: ["localizations", index, "content"],
					message: "Non-Zone content must be a Portable Text document",
				});
	if (
		object.contentLanguageSupport &&
		!ContentLanguageSupportUnitKindValues.some((kind) => kind === object.unit.kind)
	)
		context.addIssue({
			code: "custom",
			path: ["contentLanguageSupport"],
			message: `${object.unit.kind} cannot declare content language support`,
		});
	const authoredBindingFields = [
		object.labelSourceKey,
		object.structureSourceKey,
		object.creditRole,
	];
	const authoredBindingCount = authoredBindingFields.filter((value) => value !== undefined).length;
	if (authoredBindingCount > 0 && object.unit.kind !== "book")
		context.addIssue({
			code: "custom",
			message: "Only authored Book objects may declare label, structure, and credit bindings",
		});
	if (authoredBindingCount !== 0 && authoredBindingCount !== authoredBindingFields.length)
		context.addIssue({
			code: "custom",
			message: "Authored Book label, structure, and credit bindings must be declared together",
		});
	if (object.zone && object.compiledZone && object.zone.slug !== object.compiledZone.slug)
		context.addIssue({
			code: "custom",
			path: ["compiledZone", "slug"],
			message: "Authored and compiled Zone slugs must match",
		});
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
		unitVariants: z
			.array(
				z
					.object({
						mainUnitSourceKey: NonEmptyString,
						variantUnitSourceKey: NonEmptyString,
						unitKind: z.enum(VariantCapableUnitKindValues),
					})
					.strict(),
			)
			.optional(),
		credits: z
			.array(
				z
					.object({
						sourceKey: NonEmptyString,
						sourceUnitSourceKey: NonEmptyString,
						creditedUnitSourceKey: NonEmptyString,
						role: z.enum(CreditAttributionRoleValues),
						position: NonEmptyString,
					})
					.strict(),
			)
			.optional(),
		subjects: z.array(SubjectRelationSchema).optional(),
		seriesReleases: z
			.array(
				z
					.object({
						seriesSourceKey: NonEmptyString,
						releaseUnitSourceKey: NonEmptyString,
						position: NonEmptyString,
						releasedOn: CalendarDate.nullable(),
					})
					.strict(),
			)
			.optional(),
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
		tagPaths: z
			.array(
				z
					.object({
						sourceKey: NonEmptyString,
						memberTagSourceKeys: z
							.array(NonEmptyString)
							.min(2)
							.max(16)
							.refine((members) => new Set(members).size === members.length, {
								message: "A Tag Path cannot contain the same Tag more than once",
							}),
						primary: z.boolean(),
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
						pathSourceKey: NonEmptyString,
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

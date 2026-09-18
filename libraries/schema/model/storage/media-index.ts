import type { StorageModule } from "../../src/model/contracts";
/** Reviewed native referents and storage invariants; generated Drizzle is output. */
export const storage: StorageModule = {
	key: "media-index",
	output: "src/postgres/media/indexing.generated.ts",
	tableImports: {
		"../catalog/identity": ["entityIdentity"],
	},
	tables: [
		{
			symbol: "mediaBlob",
			name: "media_blob",
			meaning:
				"Storage-domain-scoped byte identity; no cross-account existence oracle or upload prerequisite.",
			decision:
				"Storage-domain-scoped byte identity; no cross-account existence oracle or upload prerequisite.",
			sourceTerms: ["https://schema.org/MediaObject", "http://purl.org/dc/terms/identifier"],
			columns: {
				id: {
					type: "uuid",
					required: true,
					primary: true,
				},
				storageDomain: {
					type: "text",
					required: true,
				},
				algorithm: {
					type: "text",
					required: true,
				},
				digest: {
					type: "text",
					required: true,
				},
				byteLength: {
					type: "numeric",
					required: true,
				},
				availability: {
					type: "text",
					required: true,
				},
				erasureEpoch: {
					type: "bigint",
					required: true,
					defaultSql: "0",
				},
			},
			constraints: [
				{
					kind: "unique",
					name: "media_blob_domain_digest",
					columns: ["storageDomain", "algorithm", "digest"],
				},
				{
					kind: "check",
					name: "media_blob_bytes",
					expression: "{byteLength}>=0 and {byteLength}=trunc({byteLength}) and {byteLength}<1e40",
				},
				{
					kind: "check",
					name: "media_blob_availability",
					expression: "{availability} in ('observed','stored','unavailable','erased')",
				},
			],
		},
		{
			symbol: "mediaBlobLocation",
			name: "media_blob_location",
			meaning: "A versioned physical location may disappear without changing byte identity.",
			decision: "A versioned physical location may disappear without changing byte identity.",
			sourceTerms: ["http://www.w3.org/ns/prov#Location"],
			columns: {
				blobId: {
					type: "uuid",
					required: true,
				},
				id: {
					type: "uuid",
					required: true,
				},
				backend: {
					type: "text",
					required: true,
				},
				objectKey: {
					type: "text",
					required: true,
				},
				objectVersion: {
					type: "text",
				},
				state: {
					type: "text",
					required: true,
				},
				verifiedAt: {
					type: "timestamp",
				},
			},
			constraints: [
				{
					kind: "primary",
					columns: ["blobId", "id"],
				},
				{
					kind: "foreign",
					name: "media_blob_location_blob_id_media_blob_id_fkey",
					columns: ["blobId"],
					table: "mediaBlob",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "check",
					name: "media_blob_location_state",
					expression: "{state} in ('pending','ready','unavailable','erased')",
				},
				{
					kind: "index",
					name: "media_blob_location_backend",
					columns: ["backend", "objectKey"],
				},
			],
		},
		{
			symbol: "mediaFetchState",
			name: "media_fetch_state",
			meaning:
				"Operational lease and retry state is authored REZICS policy, not an ontology inference.",
			decision:
				"Operational lease and retry state is authored REZICS policy, not an ontology inference.",
			sourceTerms: ["http://www.w3.org/ns/prov#Activity"],
			columns: {
				locatorId: {
					type: "uuid",
					required: true,
					primary: true,
				},
				nextAttemptAt: {
					type: "timestamp",
				},
				leaseToken: {
					type: "uuid",
				},
				leaseUntil: {
					type: "timestamp",
				},
				attempt: {
					type: "integer",
					required: true,
					defaultSql: "0",
				},
				lastObservationId: {
					type: "uuid",
				},
			},
			constraints: [
				{
					kind: "foreign",
					name: "media_fetch_state_locator_id_media_locator_id_fkey",
					columns: ["locatorId"],
					table: "mediaLocator",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "media_fetch_state_twzKeLIdgMCl_fkey",
					columns: ["lastObservationId", "locatorId"],
					table: "mediaObservation",
					target: ["id", "locatorId"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "check",
					name: "media_fetch_attempt",
					expression: "{attempt}>=0",
				},
				{
					kind: "check",
					name: "media_fetch_lease",
					expression: "num_nonnulls({leaseToken},{leaseUntil}) in (0,2)",
				},
				{
					kind: "index",
					name: "media_fetch_due_idx",
					columns: ["nextAttemptAt", "locatorId"],
				},
			],
		},
		{
			symbol: "mediaFingerprint",
			name: "media_fingerprint",
			meaning:
				"Versioned derived comparison key; a perceptual match never merges identities automatically.",
			decision:
				"Versioned derived comparison key; a perceptual match never merges identities automatically.",
			sourceTerms: ["http://purl.org/dc/terms/identifier"],
			columns: {
				mediaId: {
					type: "uuid",
					required: true,
				},
				representationId: {
					type: "uuid",
					required: true,
				},
				algorithm: {
					type: "text",
					required: true,
				},
				version: {
					type: "text",
					required: true,
				},
				digest: {
					type: "text",
					required: true,
				},
			},
			constraints: [
				{
					kind: "primary",
					columns: ["representationId", "algorithm", "version"],
				},
				{
					kind: "foreign",
					name: "media_fingerprint_media_id_media_item_id_fkey",
					columns: ["mediaId"],
					table: "mediaItem",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "media_fingerprint_UsD19LGUcSRc_fkey",
					columns: ["representationId", "mediaId"],
					table: "mediaRepresentation",
					target: ["id", "mediaId"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "index",
					name: "media_fingerprint_lookup",
					columns: ["algorithm", "version", "digest"],
				},
			],
		},
		{
			symbol: "mediaFragment",
			name: "media_fragment",
			meaning:
				"Temporal/spatial selection is relative to an exact representation; percent and pixel coordinates remain distinct.",
			decision:
				"Temporal/spatial selection is relative to an exact representation; percent and pixel coordinates remain distinct.",
			sourceTerms: [
				"http://www.w3.org/ns/oa#FragmentSelector",
				"http://www.w3.org/ns/oa#SpecificResource",
			],
			columns: {
				id: {
					type: "uuid",
					required: true,
					primary: true,
				},
				representationId: {
					type: "uuid",
					required: true,
				},
				startTicks: {
					type: "numeric",
				},
				endTicks: {
					type: "numeric",
				},
				timeScale: {
					type: "integer",
				},
				x: {
					type: "numeric",
				},
				y: {
					type: "numeric",
				},
				width: {
					type: "numeric",
				},
				height: {
					type: "numeric",
				},
				coordinateUnit: {
					type: "text",
				},
				selectorUri: {
					type: "text",
				},
			},
			constraints: [
				{
					kind: "unique",
					name: "media_fragment_id_representation",
					columns: ["id", "representationId"],
				},
				{
					kind: "foreign",
					name: "media_fragment_representation_id_media_representation_id_fkey",
					columns: ["representationId"],
					table: "mediaRepresentation",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "check",
					name: "media_fragment_percent",
					expression:
						"{coordinateUnit} is distinct from 'percent' or ({x}+{width}<=100 and {y}+{height}<=100)",
				},
				{
					kind: "check",
					name: "media_fragment_time",
					expression:
						"num_nonnulls({startTicks},{endTicks},{timeScale}) in (0,3) and ({timeScale} is null or ({timeScale}>0 and {startTicks}>=0 and {startTicks}=trunc({startTicks}) and {endTicks}=trunc({endTicks}) and {endTicks}<1e40 and {endTicks}>={startTicks}))",
				},
				{
					kind: "check",
					name: "media_fragment_space",
					expression:
						"num_nonnulls({x},{y},{width},{height},{coordinateUnit}) in (0,5) and ({coordinateUnit} is null or ({coordinateUnit} in ('pixel','percent') and {x}>=0 and {y}>=0 and {width}>0 and {height}>0))",
				},
				{
					kind: "index",
					name: "media_fragment_representation_idx",
					columns: ["representationId", "id"],
				},
			],
		},
		{
			symbol: "mediaIndexEntry",
			name: "media_index_entry",
			meaning: "Projection entry points to exact metadata input; it can be rebuilt independently.",
			decision: "Projection entry points to exact metadata input; it can be rebuilt independently.",
			sourceTerms: ["http://www.w3.org/ns/prov#wasDerivedFrom"],
			columns: {
				generationId: {
					type: "uuid",
					required: true,
				},
				mediaId: {
					type: "uuid",
					required: true,
				},
				metadataRevisionId: {
					type: "uuid",
					required: true,
				},
				payload: {
					type: "jsonb",
					required: true,
					typeScript: "Record<string, unknown>",
				},
			},
			constraints: [
				{
					kind: "primary",
					columns: ["generationId", "mediaId"],
				},
				{
					kind: "foreign",
					name: "media_index_entry_generation_id_media_index_generation_id_fkey",
					columns: ["generationId"],
					table: "mediaIndexGeneration",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "media_index_entry_media_id_media_item_id_fkey",
					columns: ["mediaId"],
					table: "mediaItem",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "media_index_entry_jqhgXSNYr4Gn_fkey",
					columns: ["mediaId", "metadataRevisionId"],
					table: "mediaMetadataRevision",
					target: ["mediaId", "id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
			],
		},
		{
			symbol: "mediaIndexGeneration",
			name: "media_index_generation",
			meaning: "Rebuildable projection generation, never authority for object identity.",
			decision: "Rebuildable projection generation, never authority for object identity.",
			sourceTerms: ["http://www.w3.org/ns/prov#wasDerivedFrom"],
			columns: {
				id: {
					type: "uuid",
					required: true,
					primary: true,
				},
				kind: {
					type: "text",
					required: true,
				},
				state: {
					type: "text",
					required: true,
				},
				inputManifestHash: {
					type: "text",
					required: true,
				},
				createdAt: {
					type: "timestamp",
					required: true,
					defaultSql: "now()",
					precision: 3,
				},
			},
			constraints: [
				{
					kind: "check",
					name: "media_index_generation_state",
					expression: "{state} in ('building','sealed','active','retired','failed')",
				},
			],
		},
		{
			symbol: "mediaItem",
			name: "media_item",
			meaning: "Indexed asset identity is local and exists before any download or hosting action.",
			decision: "Indexed asset identity is local and exists before any download or hosting action.",
			sourceTerms: ["https://schema.org/MediaObject"],
			columns: {
				id: {
					type: "uuid",
					required: true,
					primary: true,
				},
				kind: {
					type: "text",
					required: true,
					typeScript: '"image" | "video" | "audio"',
				},
				state: {
					type: "text",
					required: true,
					defaultSql: "'active'",
					typeScript: '"active" | "withdrawn" | "erased"',
				},
				createdAt: {
					type: "timestamp",
					required: true,
					defaultSql: "now()",
					precision: 3,
				},
				revision: {
					type: "bigint",
					required: true,
					defaultSql: "1",
				},
			},
			constraints: [
				{
					kind: "check",
					name: "media_item_kind",
					expression: "{kind} in ('image','video','audio')",
				},
				{
					kind: "check",
					name: "media_item_state",
					expression: "{state} in ('active','withdrawn','erased')",
				},
				{
					kind: "check",
					name: "media_item_revision",
					expression: "{revision}>0",
				},
			],
		},
		{
			symbol: "mediaLocator",
			name: "media_locator",
			meaning: "An observed URL is not unique content identity and may change what it serves.",
			decision: "An observed URL is not unique content identity and may change what it serves.",
			sourceTerms: ["https://schema.org/contentUrl"],
			columns: {
				id: {
					type: "uuid",
					required: true,
					primary: true,
				},
				mediaId: {
					type: "uuid",
					required: true,
				},
				url: {
					type: "text",
					required: true,
				},
				urlHash: {
					type: "text",
					required: true,
				},
				provider: {
					type: "text",
				},
				externalKey: {
					type: "text",
				},
				firstObservedAt: {
					type: "timestamp",
					required: true,
					defaultSql: "now()",
					precision: 3,
				},
			},
			constraints: [
				{
					kind: "unique",
					name: "media_locator_id_media",
					columns: ["id", "mediaId"],
				},
				{
					kind: "foreign",
					name: "media_locator_media_id_media_item_id_fkey",
					columns: ["mediaId"],
					table: "mediaItem",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "check",
					name: "media_locator_hash",
					expression: "encode(sha256(convert_to({url},'UTF8')),'hex')={urlHash}",
				},
				{
					kind: "index",
					name: "media_locator_url_idx",
					columns: ["urlHash", "id"],
				},
				{
					kind: "index",
					name: "media_locator_media_idx",
					columns: ["mediaId", "id"],
				},
			],
		},
		{
			symbol: "mediaMetadataRevision",
			name: "media_metadata_revision",
			meaning:
				"Revision-local editor attribution and retained evidence; authorship is an identified relation.",
			decision:
				"Revision-local editor attribution and retained evidence; authorship is an identified relation.",
			sourceTerms: ["http://www.w3.org/ns/prov#wasRevisionOf"],
			columns: {
				mediaId: {
					type: "uuid",
					required: true,
				},
				id: {
					type: "uuid",
					required: true,
				},
				parentId: {
					type: "uuid",
				},
				creatorEntityId: {
					type: "uuid",
				},
				fields: {
					type: "jsonb",
					required: true,
					typeScript: "Record<string, unknown>",
				},
				evidence: {
					type: "jsonb",
					required: true,
					typeScript: "string[]",
				},
				createdAt: {
					type: "timestamp",
					required: true,
					defaultSql: "now()",
					precision: 3,
				},
			},
			constraints: [
				{
					kind: "primary",
					columns: ["mediaId", "id"],
				},
				{
					kind: "foreign",
					name: "media_metadata_revision_media_id_media_item_id_fkey",
					columns: ["mediaId"],
					table: "mediaItem",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "media_metadata_revision_5nK9j22SRsVy_fkey",
					columns: ["creatorEntityId"],
					table: "entityIdentity",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "media_metadata_revision_APCzyF1ocq0M_fkey",
					columns: ["mediaId", "parentId"],
					table: "mediaMetadataRevision",
					target: ["mediaId", "id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "check",
					name: "media_metadata_shape",
					expression: "jsonb_typeof({fields})='object' and jsonb_typeof({evidence})='array'",
				},
			],
		},
		{
			symbol: "mediaMetadataSelection",
			name: "media_metadata_selection",
			meaning: "Explicit selected metadata revision with a local compare-and-set version.",
			decision: "Explicit selected metadata revision with a local compare-and-set version.",
			sourceTerms: ["http://www.w3.org/ns/prov#Activity"],
			columns: {
				mediaId: {
					type: "uuid",
					required: true,
					primary: true,
				},
				revisionId: {
					type: "uuid",
					required: true,
				},
				version: {
					type: "bigint",
					required: true,
				},
				selectedAt: {
					type: "timestamp",
					required: true,
					defaultSql: "now()",
					precision: 3,
				},
			},
			constraints: [
				{
					kind: "foreign",
					name: "media_metadata_selection_media_id_media_item_id_fkey",
					columns: ["mediaId"],
					table: "mediaItem",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "media_metadata_selection_ZwVRJ5La8g96_fkey",
					columns: ["mediaId", "revisionId"],
					table: "mediaMetadataRevision",
					target: ["mediaId", "id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "check",
					name: "media_metadata_selection_version",
					expression: "{version}>0",
				},
			],
		},
		{
			symbol: "mediaObservation",
			name: "media_observation",
			meaning: "An observation is immutable evidence about availability/headers/bytes at a time.",
			decision: "An observation is immutable evidence about availability/headers/bytes at a time.",
			sourceTerms: ["http://www.w3.org/ns/prov#Entity"],
			columns: {
				id: {
					type: "uuid",
					required: true,
					primary: true,
				},
				mediaId: {
					type: "uuid",
					required: true,
				},
				locatorId: {
					type: "uuid",
				},
				observedAt: {
					type: "timestamp",
					required: true,
					defaultSql: "now()",
					precision: 3,
				},
				status: {
					type: "text",
					required: true,
				},
				contentHash: {
					type: "text",
				},
				etag: {
					type: "text",
				},
				mimeType: {
					type: "text",
				},
				byteLength: {
					type: "numeric",
				},
				artifactBlobId: {
					type: "uuid",
				},
				evidenceUri: {
					type: "text",
				},
			},
			constraints: [
				{
					kind: "unique",
					name: "media_observation_id_media",
					columns: ["id", "mediaId"],
				},
				{
					kind: "unique",
					name: "media_observation_id_locator",
					columns: ["id", "locatorId"],
				},
				{
					kind: "foreign",
					name: "media_observation_media_id_media_item_id_fkey",
					columns: ["mediaId"],
					table: "mediaItem",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "media_observation_artifact_blob_id_media_blob_id_fkey",
					columns: ["artifactBlobId"],
					table: "mediaBlob",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "media_observation_ReLHqwW6wdPy_fkey",
					columns: ["locatorId", "mediaId"],
					table: "mediaLocator",
					target: ["id", "mediaId"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "check",
					name: "media_observation_status",
					expression: "{status} in ('available','unavailable','forbidden','unknown')",
				},
				{
					kind: "check",
					name: "media_observation_bytes",
					expression:
						"{byteLength} is null or {byteLength}>=0 and {byteLength}=trunc({byteLength}) and {byteLength}<1e40",
				},
				{
					kind: "index",
					name: "media_observation_locator_time",
					columns: ["locatorId", "observedAt", "id"],
				},
			],
		},
		{
			symbol: "mediaOccurrence",
			name: "media_occurrence",
			meaning:
				"One appearance within an exact page version and selector; repeated appearances are not deduplicated by bytes.",
			decision:
				"One appearance within an exact page version and selector; repeated appearances are not deduplicated by bytes.",
			sourceTerms: ["http://www.w3.org/ns/oa#SpecificResource"],
			columns: {
				id: {
					type: "uuid",
					required: true,
					primary: true,
				},
				mediaId: {
					type: "uuid",
					required: true,
				},
				pageUri: {
					type: "text",
					required: true,
				},
				pageUriHash: {
					type: "text",
					required: true,
				},
				pageRevision: {
					type: "text",
					required: true,
				},
				selector: {
					type: "text",
					required: true,
				},
				selectorHash: {
					type: "text",
					required: true,
				},
				observationId: {
					type: "uuid",
				},
				observedAt: {
					type: "timestamp",
					required: true,
					defaultSql: "now()",
					precision: 3,
				},
			},
			constraints: [
				{
					kind: "unique",
					name: "media_occurrence_page_location",
					columns: ["pageUriHash", "pageRevision", "selectorHash", "mediaId"],
				},
				{
					kind: "foreign",
					name: "media_occurrence_media_id_media_item_id_fkey",
					columns: ["mediaId"],
					table: "mediaItem",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "media_occurrence_jSzLxDkhUGhn_fkey",
					columns: ["observationId", "mediaId"],
					table: "mediaObservation",
					target: ["id", "mediaId"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "index",
					name: "media_occurrence_media_idx",
					columns: ["mediaId", "id"],
				},
			],
		},
		{
			symbol: "mediaRepresentation",
			name: "media_representation",
			meaning:
				"Encoded representation with exact pixel/tick measures; multiple encodings share an asset without sharing bytes.",
			decision:
				"Encoded representation with exact pixel/tick measures; multiple encodings share an asset without sharing bytes.",
			sourceTerms: ["https://schema.org/MediaObject", "https://schema.org/encodingFormat"],
			columns: {
				id: {
					type: "uuid",
					required: true,
					primary: true,
				},
				mediaId: {
					type: "uuid",
					required: true,
				},
				observationId: {
					type: "uuid",
				},
				blobId: {
					type: "uuid",
				},
				mimeType: {
					type: "text",
					required: true,
				},
				codec: {
					type: "text",
				},
				width: {
					type: "numeric",
				},
				height: {
					type: "numeric",
				},
				durationTicks: {
					type: "numeric",
				},
				timeScale: {
					type: "integer",
				},
				channels: {
					type: "integer",
				},
				sampleRate: {
					type: "integer",
				},
				byteLength: {
					type: "numeric",
				},
				createdAt: {
					type: "timestamp",
					required: true,
					defaultSql: "now()",
					precision: 3,
				},
			},
			constraints: [
				{
					kind: "unique",
					name: "media_representation_id_media",
					columns: ["id", "mediaId"],
				},
				{
					kind: "foreign",
					name: "media_representation_media_id_media_item_id_fkey",
					columns: ["mediaId"],
					table: "mediaItem",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "media_representation_blob_id_media_blob_id_fkey",
					columns: ["blobId"],
					table: "mediaBlob",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "media_representation_PMrP5FqF46QH_fkey",
					columns: ["observationId", "mediaId"],
					table: "mediaObservation",
					target: ["id", "mediaId"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "check",
					name: "media_representation_values",
					expression:
						"({byteLength} is null or {byteLength}>=0 and {byteLength}=trunc({byteLength}) and {byteLength}<1e40) and ({channels} is null or {channels}>0) and ({sampleRate} is null or {sampleRate}>0)",
				},
				{
					kind: "check",
					name: "media_representation_dimensions",
					expression:
						"({width} is null or {width}>0 and {width}=trunc({width}) and {width}<1e40) and ({height} is null or {height}>0 and {height}=trunc({height}) and {height}<1e40)",
				},
				{
					kind: "check",
					name: "media_representation_time",
					expression:
						"num_nonnulls({durationTicks},{timeScale}) in (0,2) and ({durationTicks} is null or ({durationTicks}>=0 and {durationTicks}=trunc({durationTicks}) and {durationTicks}<1e40 and {timeScale}>0))",
				},
				{
					kind: "index",
					name: "media_representation_media_idx",
					columns: ["mediaId", "id"],
				},
			],
		},
		{
			symbol: "mediaStream",
			name: "media_stream",
			meaning: "Ordered elementary streams belong to a representation, not a new creative work.",
			decision: "Ordered elementary streams belong to a representation, not a new creative work.",
			sourceTerms: ["http://purl.org/dc/terms/hasPart"],
			columns: {
				representationId: {
					type: "uuid",
					required: true,
				},
				ordinal: {
					type: "integer",
					required: true,
				},
				kind: {
					type: "text",
					required: true,
				},
				codec: {
					type: "text",
				},
				language: {
					type: "text",
				},
				durationTicks: {
					type: "numeric",
				},
				timeScale: {
					type: "integer",
				},
			},
			constraints: [
				{
					kind: "primary",
					columns: ["representationId", "ordinal"],
				},
				{
					kind: "foreign",
					name: "media_stream_representation_id_media_representation_id_fkey",
					columns: ["representationId"],
					table: "mediaRepresentation",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "check",
					name: "media_stream_time",
					expression:
						"num_nonnulls({durationTicks},{timeScale}) in (0,2) and ({durationTicks} is null or ({durationTicks}>=0 and {durationTicks}=trunc({durationTicks}) and {durationTicks}<1e40 and {timeScale}>0))",
				},
				{
					kind: "check",
					name: "media_stream_kind",
					expression: "{kind} in ('video','audio','subtitle','data') and {ordinal}>=0",
				},
			],
		},
	],
};

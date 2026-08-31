import {
	CustomThemeHumanReviewEvidenceV0,
	CustomThemeRevisionFileRoleValues,
	CustomThemeRevisionStateValues,
	MaximumCustomThemeInitialCodeBytes,
	ReviewedExternalResourceV0,
	SubmittedCustomThemeManifestV0,
	UnitPresentationDocumentV0,
} from "@rezics/block";
import { type StaticDecode, Type } from "typebox";
import { t } from "elysia";

import {
	ContentLanguage,
	DateTime,
	RevisionContext,
	UnitLocalizationContentFields,
	UnitLocalizationInput,
	Uuid,
} from "../schema";

const Sha256Hex = t.String({ pattern: "^[0-9a-f]{64}$" });
const Base64 = t.String({
	maxLength: Math.ceil(MaximumCustomThemeInitialCodeBytes / 3) * 4,
});
const UnitPresentationInputDocument = Type.Unsafe<StaticDecode<typeof UnitPresentationDocumentV0>>(
	UnitPresentationDocumentV0,
);
const UnitPresentationResponseDocument = Type.Unsafe<unknown>(UnitPresentationDocumentV0);
const SubmittedCustomThemeFileRoleValues = [
	"html",
	"css",
	"js",
	"worker",
	"wasm",
	"font",
	"svg",
	"asset",
] as const;

export const CustomThemeParams = t.Object({ themeUnitId: Uuid });
export const CustomThemeRevisionParams = t.Object({ themeUnitId: Uuid, revisionId: Uuid });
export const CustomThemeReferenceRenderArtifactParams = t.Object({
	themeUnitId: Uuid,
	revisionId: Uuid,
	screenshotAssetId: Uuid,
});
export const CustomThemeLocalizationParams = t.Object({
	themeUnitId: Uuid,
	language: ContentLanguage,
});
export const HostUnitParams = t.Object({ unitId: Uuid });

export const CreateCustomThemeBody = t.Object(
	{ localization: UnitLocalizationInput },
	{ additionalProperties: false },
);

export const CustomThemeLocalizationBody = t.Object(
	{ ...UnitLocalizationContentFields, revisionContext: t.Optional(RevisionContext) },
	{ additionalProperties: false },
);

const SubmittedRevisionFile = t.Object(
	{
		path: t.String({ minLength: 1, maxLength: 512 }),
		role: t.UnionEnum(SubmittedCustomThemeFileRoleValues),
		contentType: t.String({ minLength: 1, maxLength: 255 }),
		contentBase64: Base64,
	},
	{ additionalProperties: false },
);

export const SubmitCustomThemeRevisionBody = t.Object(
	{
		manifest: SubmittedCustomThemeManifestV0,
		sourceArchive: t.Object(
			{
				contentType: t.String({ minLength: 1, maxLength: 255 }),
				contentBase64: t.String({ maxLength: 27_962_028 }),
			},
			{ additionalProperties: false },
		),
		files: t.Array(SubmittedRevisionFile, { maxItems: 256 }),
	},
	{ additionalProperties: false },
);

export const CustomThemeCursorQuery = t.Object(
	{
		cursor: t.Optional(Uuid),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 25 })),
	},
	{ additionalProperties: false },
);

export const CustomThemeResponse = t.Object({
	id: Uuid,
	language: t.String(),
	title: t.String(),
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const CustomThemeRevisionFileResponse = t.Object({
	path: t.String(),
	role: t.UnionEnum(CustomThemeRevisionFileRoleValues),
	contentType: t.String(),
	sha256: Sha256Hex,
	byteLength: t.Integer({ minimum: 0 }),
});

export const CustomThemeRevisionResponse = t.Object({
	id: Uuid,
	customThemeUnitId: Uuid,
	targetContract: t.Literal("rezics.unit.presentation@0"),
	executionMode: t.Literal("host_full_trust"),
	resourceMode: t.Literal("external_live"),
	manifest: SubmittedCustomThemeManifestV0,
	manifestSha256: Sha256Hex,
	sourceArchiveSha256: Sha256Hex,
	reviewState: t.UnionEnum(CustomThemeRevisionStateValues),
	approvalScope: t.Literal("host_unit"),
	approvedHostUnitId: t.Nullable(Uuid),
	submittedByProfileId: Uuid,
	reviewedByProfileId: t.Nullable(Uuid),
	reviewedAt: t.Nullable(DateTime),
	decisionReason: t.Nullable(t.String()),
	killedAt: t.Nullable(DateTime),
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const CustomThemeRevisionListResponse = t.Object({
	items: t.Array(CustomThemeRevisionResponse),
	nextCursor: t.Nullable(Uuid),
});

export const CustomThemeReviewQueueResponse = t.Object({
	items: t.Array(
		t.Object({
			...CustomThemeRevisionResponse.properties,
			files: t.Array(CustomThemeRevisionFileResponse),
			externalResources: t.Array(ReviewedExternalResourceV0),
			reviewEvidence: t.Nullable(t.Record(t.String(), t.Unknown())),
		}),
	),
	nextCursor: t.Nullable(Uuid),
});

export const DecideCustomThemeRevisionBody = t.Union([
	t.Object(
		{
			decision: t.Literal("approve"),
			hostUnitId: Uuid,
			reason: t.Optional(t.String({ minLength: 1, maxLength: 2_000 })),
			...CustomThemeHumanReviewEvidenceV0.properties,
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			decision: t.Literal("reject"),
			reason: t.String({ minLength: 1, maxLength: 2_000 }),
		},
		{ additionalProperties: false },
	),
]);

export const KillCustomThemeRevisionBody = t.Object(
	{ reason: t.String({ minLength: 1, maxLength: 2_000 }) },
	{ additionalProperties: false },
);

export const UnitPresentationResponse = t.Object(
	{
		targetContract: t.Literal("rezics.unit.presentation@0"),
		document: UnitPresentationResponseDocument,
		revisionId: t.Nullable(Uuid),
	},
	{ $id: "UnitPresentationResponse" },
);

export const PutUnitPresentationBody = t.Object(
	{
		expectedRevisionId: t.Nullable(Uuid),
		document: UnitPresentationInputDocument,
	},
	{ additionalProperties: false },
);

export const PutCustomThemeInstallationBody = t.Object(
	{ revisionId: Uuid },
	{ additionalProperties: false },
);

export const CustomThemeInstallationResponse = t.Object({
	hostUnitId: Uuid,
	targetContract: t.Literal("rezics.unit.presentation@0"),
	revisionId: Uuid,
	installedByProfileId: Uuid,
	createdAt: DateTime,
	updatedAt: DateTime,
});

const ResolvedPackagedFile = t.Object({
	path: t.String(),
	role: t.UnionEnum(CustomThemeRevisionFileRoleValues),
	contentType: t.String(),
	sha256: Sha256Hex,
	contentUrl: t.String({ minLength: 1 }),
});

export const CustomThemeFileQuery = t.Object(
	{
		path: t.String({ minLength: 1, maxLength: 512 }),
		hostUnitId: Uuid,
	},
	{ additionalProperties: false },
);

export const ResolvedUnitPresentationResponse = t.Object(
	{
		targetContract: t.Literal("rezics.unit.presentation@0"),
		document: UnitPresentationResponseDocument,
		documentRevisionId: t.Nullable(Uuid),
		customTheme: t.Nullable(
			t.Object({
				revisionId: Uuid,
				customThemeUnitId: Uuid,
				executionMode: t.Literal("host_full_trust"),
				resourceMode: t.Literal("external_live"),
				executionAudience: t.Literal("capability_gated_preview"),
				approvalScope: t.Object({ kind: t.Literal("host_unit"), hostUnitId: Uuid }),
				manifest: SubmittedCustomThemeManifestV0,
				externalResources: t.Array(ReviewedExternalResourceV0),
				packagedFiles: t.Array(ResolvedPackagedFile),
			}),
		),
		fallbackReason: t.Nullable(
			t.UnionEnum([
				"none_installed",
				"safe_mode",
				"global_disabled",
				"viewer_ineligible",
				"viewer_opt_out",
				"revision_unavailable",
			] as const),
		),
	},
	{ $id: "ResolvedUnitPresentationResponse" },
);

export const ResolveUnitPresentationQuery = t.Object(
	{ safeMode: t.Optional(t.Boolean({ default: false })) },
	{ additionalProperties: false },
);

export const CustomThemeExecutionControlResponse = t.Object({
	enabled: t.Boolean(),
	updatedByProfileId: t.Nullable(Uuid),
	updatedAt: DateTime,
});

export const SetCustomThemeExecutionControlBody = t.Object(
	{ enabled: t.Boolean(), reason: t.String({ minLength: 1, maxLength: 2_000 }) },
	{ additionalProperties: false },
);

export const PresentationPolicyResponse = t.Object({
	revisionId: t.Nullable(Uuid),
	scriptOrigins: t.Array(t.String()),
	styleOrigins: t.Array(t.String()),
	connectOrigins: t.Array(t.String()),
	imageOrigins: t.Array(t.String()),
	fontOrigins: t.Array(t.String()),
	frameOrigins: t.Array(t.String()),
	mediaOrigins: t.Array(t.String()),
});

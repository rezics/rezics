import { JsonValue, type JsonValue as JsonValueType } from "@rezics/portable-text";
import {
	DockDocument,
	NavigationDocument,
	PortableTextDocument,
	UnitReferencedBlockDocument,
	ZoneBoundaryDocument,
	ZoneThemeDocument,
} from "@rezics/block";
import { type Static, Type } from "@sinclair/typebox";
import { t } from "elysia";

import {
	DateTime,
	FractionalPosition,
	FractionalPositionInput,
	ContentLanguage,
	LocalizationLanguageQuery,
	UnitLocalizationInput,
	Uuid,
} from "../schema";
import { AvatarResponse, ImageAssetResponse } from "../schema/response";
import { NullablePublicSlugAddressResponse } from "../slug-addresses/schema";

// Exact models are registered by the Zone route plugin. References keep one
// OpenAPI component and prevent recursive Block static types from expanding
// through the entire Elysia route chain.
const ZoneBoundaryResponseDocument = Type.Unsafe<unknown>(Type.Ref("ZoneBoundaryDocument"));
const ZoneThemeResponseDocument = Type.Unsafe<unknown>(Type.Ref("ZoneThemeDocument"));
const UnitReferencedBlockResponseDocument = Type.Unsafe<unknown>(
	Type.Ref("UnitReferencedBlockDocument"),
);
const NavigationResponseDocument = Type.Unsafe<unknown>(Type.Ref("NavigationDocument"));
const DockResponseDocument = Type.Unsafe<unknown>(Type.Ref(DockDocument));
const PortableTextResponseDocument = Type.Unsafe<unknown>(Type.Ref(PortableTextDocument));
const ZoneBoundaryInputDocument = Type.Unsafe<Static<typeof ZoneBoundaryDocument>>(
	Type.Ref("ZoneBoundaryDocument"),
);
const ZoneThemeInputDocument = Type.Unsafe<Static<typeof ZoneThemeDocument>>(
	Type.Ref("ZoneThemeDocument"),
);
const UnitReferencedBlockInputDocument = Type.Unsafe<Static<typeof UnitReferencedBlockDocument>>(
	Type.Ref("UnitReferencedBlockDocument"),
);
const NavigationInputDocument = Type.Unsafe<Static<typeof NavigationDocument>>(
	Type.Ref("NavigationDocument"),
);

export const CreateSeriesBody = t.Object(
	{
		kind: t.String({ minLength: 1, maxLength: 64 }),
		localization: UnitLocalizationInput,
	},
	{ additionalProperties: false },
);
export const SeriesParams = t.Object({ seriesId: Uuid });
export const SeriesReleaseListQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export const SeriesReleaseParams = t.Object({ seriesId: Uuid, releaseId: Uuid });
export const UpsertSeriesReleaseBody = t.Object(
	{
		position: FractionalPositionInput,
		releasedOn: t.Optional(t.Nullable(t.String({ format: "date" }))),
	},
	{ additionalProperties: false },
);

export const SoftwareParams = t.Object({ softwareId: Uuid });
export const SoftwareRequirementParams = t.Object({
	softwareId: Uuid,
	requirementId: Uuid,
});
export const SystemRequirementBody = t.Object(
	{
		platformEntityId: t.Optional(t.Nullable(Uuid)),
		tier: t.String({ minLength: 1, maxLength: 32 }),
		sourceExternalLinkId: t.Optional(t.Nullable(Uuid)),
		hardware: t.Record(t.String(), JsonValue),
	},
	{ additionalProperties: false },
);

const SystemRequirementHardwareResponse = Type.Unsafe<Record<string, JsonValueType>>(
	t.Record(t.String(), JsonValue),
);

export const CreateZoneBody = t.Object(
	{
		localization: UnitLocalizationInput,
		boundaryDocument: ZoneBoundaryInputDocument,
		themeDocument: ZoneThemeInputDocument,
		startsAt: t.Optional(t.Nullable(t.String({ format: "date-time" }))),
		endsAt: t.Optional(t.Nullable(t.String({ format: "date-time" }))),
	},
	{ additionalProperties: false },
);
export const ZoneParams = t.Object({ zoneId: Uuid });
export const ZoneDetailQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export const ZoneRenderQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		page: t.Optional(
			t.String({ minLength: 1, maxLength: 100, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
		),
		pageId: t.Optional(Uuid),
		postId: t.Optional(Uuid),
	},
	{ additionalProperties: false },
);
export const ZonePageIdParams = t.Object({ zoneId: Uuid, pageId: Uuid });
export const ZoneNavigationParams = t.Object({
	zoneId: Uuid,
	navigationId: Uuid,
});
export const UpdateZoneBody = t.Object(
	{
		localization: t.Optional(UnitLocalizationInput),
		boundaryDocument: t.Optional(ZoneBoundaryInputDocument),
		themeDocument: t.Optional(ZoneThemeInputDocument),
		startsAt: t.Optional(t.Nullable(t.String({ format: "date-time" }))),
		endsAt: t.Optional(t.Nullable(t.String({ format: "date-time" }))),
	},
	{ minProperties: 1, additionalProperties: false },
);
export const ZonePageBody = t.Object(
	{
		slug: t.Optional(
			t.Nullable(
				t.String({
					minLength: 1,
					maxLength: 63,
					pattern: "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$",
				}),
			),
		),
		localization: t.Object(
			{
				language: ContentLanguage,
				title: t.String({ minLength: 1, maxLength: 500 }),
				document: UnitReferencedBlockInputDocument,
			},
			{ additionalProperties: false },
		),
		baseUnitRevisionId: t.Optional(Uuid),
	},
	{ additionalProperties: false },
);
export const ZonePagePlacementBody = t.Object(
	{
		position: t.Optional(FractionalPositionInput),
		parentPageId: t.Optional(t.Nullable(Uuid)),
		baseStructureRevisionId: t.Optional(Uuid),
	},
	{ additionalProperties: false },
);
export const ZonePagePlacementDeleteBody = t.Object(
	{ baseStructureRevisionId: Uuid },
	{ additionalProperties: false },
);
export const ZoneNavigationBody = t.Object(
	{
		document: NavigationInputDocument,
	},
	{ additionalProperties: false },
);
export const ZoneNavigationReplaceBody = t.Object(
	{
		document: NavigationInputDocument,
		baseRevisionId: Uuid,
	},
	{ additionalProperties: false },
);
export const ZoneNavigationRevisionBody = t.Object(
	{ baseRevisionId: Uuid },
	{ additionalProperties: false },
);

export const SeriesReleaseResponse = t.Object({
	seriesId: Uuid,
	releaseUnitId: Uuid,
	position: FractionalPosition,
	releasedOn: t.Nullable(t.String()),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const SeriesReleaseListResponse = t.Object({
	items: t.Array(
		t.Intersect([
			SeriesReleaseResponse,
			t.Object({
				release: t.Object({
					id: Uuid,
					type: t.Union([t.Literal("book"), t.Literal("software"), t.Literal("media")]),
					language: ContentLanguage,
					title: t.Nullable(t.String()),
					cover: ImageAssetResponse,
				}),
			}),
		]),
	),
});

export const SystemRequirementResponse = t.Object({
	id: Uuid,
	softwareId: Uuid,
	platformEntityId: t.Nullable(Uuid),
	tier: t.String(),
	sourceExternalLinkId: t.Nullable(Uuid),
	hardware: SystemRequirementHardwareResponse,
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const SystemRequirementListResponse = t.Object({
	items: t.Array(SystemRequirementResponse),
});

export const ZoneResponse = t.Object({
	id: Uuid,
	slugAddress: NullablePublicSlugAddressResponse,
	language: t.Nullable(ContentLanguage),
	avatar: AvatarResponse,
	banner: ImageAssetResponse,
	cover: ImageAssetResponse,
	localizations: t.Array(
		t.Object({
			language: ContentLanguage,
			title: t.Nullable(t.String()),
			summary: t.Nullable(t.String()),
			avatar: AvatarResponse,
			banner: ImageAssetResponse,
			cover: ImageAssetResponse,
		}),
	),
	boundaryDocument: ZoneBoundaryResponseDocument,
	themeDocument: ZoneThemeResponseDocument,
	startsAt: t.Nullable(DateTime),
	endsAt: t.Nullable(DateTime),
	capabilities: t.Object({ canManage: t.Boolean() }),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const ZonePageResponse = t.Object({
	id: Uuid,
	zoneId: Uuid,
	slug: t.Nullable(t.String()),
	document: UnitReferencedBlockResponseDocument,
	home: t.Boolean(),
	placement: t.Nullable(
		t.Object({
			structureId: Uuid,
			nodeId: Uuid,
			parentPageId: t.Nullable(Uuid),
			position: FractionalPosition,
			latestStructureRevisionId: Uuid,
		}),
	),
	language: ContentLanguage,
	title: t.String(),
	localizations: t.Array(
		t.Object({
			language: ContentLanguage,
			title: t.String(),
			document: UnitReferencedBlockResponseDocument,
			contentStatus: t.UnionEnum(["draft", "published", "archived"]),
		}),
	),
	latestUnitRevisionId: Uuid,
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const ZonePageListResponse = t.Object({
	items: t.Array(ZonePageResponse),
	pageStructure: t.Nullable(
		t.Object({
			id: Uuid,
			latestRevisionId: Uuid,
		}),
	),
});
export const ZoneNavigationResponse = t.Object({
	id: Uuid,
	zoneId: Uuid,
	document: NavigationResponseDocument,
	latestRevisionId: Uuid,
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const ZoneNavigationListResponse = t.Object({ items: t.Array(ZoneNavigationResponse) });

export const ZoneRenderUnitResponse = t.Object({
	id: Uuid,
	kind: t.String(),
	zonePageSlug: t.Nullable(t.String()),
	language: t.Nullable(ContentLanguage),
	title: t.Nullable(t.String()),
	summary: t.Nullable(t.String()),
	avatar: AvatarResponse,
	banner: ImageAssetResponse,
	cover: ImageAssetResponse,
});
export const ZoneRenderWikiPostResponse = t.Object({
	...ZoneRenderUnitResponse.properties,
	body: PortableTextResponseDocument,
});
export const ZoneRenderResponse = t.Object({
	zone: ZoneResponse,
	page: t.Nullable(ZonePageResponse),
	dock: t.Nullable(
		t.Object({
			unitId: Uuid,
			surface: t.Literal("main"),
			document: DockResponseDocument,
		}),
	),
	navigations: t.Array(ZoneNavigationResponse),
	references: t.Object({
		units: t.Array(ZoneRenderUnitResponse),
		wikiPosts: t.Array(ZoneRenderWikiPostResponse),
		assets: t.Array(t.Object({ id: Uuid, url: t.String() })),
	}),
});

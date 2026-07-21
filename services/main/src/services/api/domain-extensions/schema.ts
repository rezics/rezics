import { JsonValue } from "@rezics/portable-text";
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

import { DateTime, FractionalPosition, ContentLanguage, LocalizationInput, Uuid } from "../schema";
import { ImageAssetResponse } from "../schema/response";
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
		localization: LocalizationInput,
	},
	{ additionalProperties: false },
);
export const SeriesParams = t.Object({ seriesId: Uuid });
export const SeriesReleaseParams = t.Object({ seriesId: Uuid, releaseId: Uuid });
export const UpsertSeriesReleaseBody = t.Object(
	{
		position: FractionalPosition,
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
		sourceLinkId: t.Optional(t.Nullable(Uuid)),
		hardware: t.Record(t.String(), JsonValue),
	},
	{ additionalProperties: false },
);

export const CreateZoneBody = t.Object(
	{
		localization: LocalizationInput,
		boundaryDocument: ZoneBoundaryInputDocument,
		themeDocument: ZoneThemeInputDocument,
		startsAt: t.Optional(t.Nullable(t.String({ format: "date-time" }))),
		endsAt: t.Optional(t.Nullable(t.String({ format: "date-time" }))),
	},
	{ additionalProperties: false },
);
export const ZoneParams = t.Object({ zoneId: Uuid });
export const ZoneDetailQuery = t.Object({ language: t.Optional(ContentLanguage) });
export const ZoneRenderQuery = t.Object({
	language: t.Optional(ContentLanguage),
	page: t.Optional(
		t.String({ minLength: 1, maxLength: 100, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
	),
});
export const ZonePageParams = t.Object({
	zoneId: Uuid,
	slug: t.String({ minLength: 1, maxLength: 100, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
});
export const ZoneNavigationParams = t.Object({
	zoneId: Uuid,
	navigationId: Uuid,
});
export const UpdateZoneBody = t.Object(
	{
		localization: t.Optional(LocalizationInput),
		boundaryDocument: t.Optional(ZoneBoundaryInputDocument),
		themeDocument: t.Optional(ZoneThemeInputDocument),
		startsAt: t.Optional(t.Nullable(t.String({ format: "date-time" }))),
		endsAt: t.Optional(t.Nullable(t.String({ format: "date-time" }))),
	},
	{ minProperties: 1, additionalProperties: false },
);
export const ZonePageBody = t.Object(
	{
		titleUnitId: Uuid,
		document: UnitReferencedBlockInputDocument,
		position: FractionalPosition,
		home: t.Boolean(),
	},
	{ additionalProperties: false },
);
export const ZoneNavigationBody = t.Object(
	{
		document: NavigationInputDocument,
	},
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
export const SeriesReleaseListResponse = t.Object({ items: t.Array(SeriesReleaseResponse) });

export const SystemRequirementResponse = t.Object({
	id: Uuid,
	softwareId: Uuid,
	platformEntityId: t.Nullable(Uuid),
	tier: t.String(),
	sourceLinkId: t.Nullable(Uuid),
	hardware: t.Unknown(),
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
	avatar: ImageAssetResponse,
	banner: ImageAssetResponse,
	cover: ImageAssetResponse,
	localizations: t.Array(
		t.Object({
			language: ContentLanguage,
			title: t.Nullable(t.String()),
			summary: t.Nullable(t.String()),
			avatar: ImageAssetResponse,
			banner: ImageAssetResponse,
			cover: ImageAssetResponse,
		}),
	),
	boundaryDocument: ZoneBoundaryResponseDocument,
	themeDocument: ZoneThemeResponseDocument,
	startsAt: t.Nullable(DateTime),
	endsAt: t.Nullable(DateTime),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const ZonePageResponse = t.Object({
	id: Uuid,
	zoneId: Uuid,
	slug: t.String(),
	titleUnitId: Uuid,
	document: UnitReferencedBlockResponseDocument,
	position: FractionalPosition,
	home: t.Boolean(),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const ZonePageListResponse = t.Object({ items: t.Array(ZonePageResponse) });
export const ZoneNavigationResponse = t.Object({
	id: Uuid,
	zoneId: Uuid,
	document: NavigationResponseDocument,
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const ZoneNavigationListResponse = t.Object({ items: t.Array(ZoneNavigationResponse) });

export const ZoneRenderUnitResponse = t.Object({
	id: Uuid,
	kind: t.String(),
	language: t.Nullable(ContentLanguage),
	title: t.Nullable(t.String()),
	summary: t.Nullable(t.String()),
	avatar: ImageAssetResponse,
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

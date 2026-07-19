import { JsonValue } from "@rezics/portable-text";
import {
	NavigationDocument,
	UnitReferencedBlockDocument,
	ZoneBoundaryDocument,
	ZoneThemeDocument,
} from "@rezics/block";
import { type Static, Type } from "@sinclair/typebox";
import { t } from "elysia";

import { DateTime, FractionalPosition, LocalizationInput, Uuid } from "../schema";

// Exact models are registered by the Zone route plugin. References keep one
// OpenAPI component and prevent recursive Block static types from expanding
// through the entire Elysia route chain.
const ZoneBoundaryResponseDocument = Type.Unsafe<unknown>(Type.Ref("ZoneBoundaryDocument"));
const ZoneThemeResponseDocument = Type.Unsafe<unknown>(Type.Ref("ZoneThemeDocument"));
const UnitReferencedBlockResponseDocument = Type.Unsafe<unknown>(
	Type.Ref("UnitReferencedBlockDocument"),
);
const NavigationResponseDocument = Type.Unsafe<unknown>(Type.Ref("NavigationDocument"));
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
		slug: t.Optional(
			t.String({ minLength: 3, maxLength: 63, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
		),
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
		slug: t.Optional(
			t.String({ minLength: 3, maxLength: 63, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
		),
		localization: LocalizationInput,
		boundaryDocument: ZoneBoundaryInputDocument,
		themeDocument: ZoneThemeInputDocument,
		dockDocument: UnitReferencedBlockInputDocument,
		startsAt: t.Optional(t.Nullable(t.String({ format: "date-time" }))),
		endsAt: t.Optional(t.Nullable(t.String({ format: "date-time" }))),
	},
	{ additionalProperties: false },
);
export const ZoneParams = t.Object({ zoneId: Uuid });
export const ZonePageParams = t.Object({
	zoneId: Uuid,
	slug: t.String({ minLength: 1, maxLength: 100, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
});
export const ZoneNavigationParams = t.Object({
	zoneId: Uuid,
	key: t.String({ minLength: 1, maxLength: 64, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
});
export const UpdateZoneBody = t.Object(
	{
		boundaryDocument: t.Optional(ZoneBoundaryInputDocument),
		themeDocument: t.Optional(ZoneThemeInputDocument),
		dockDocument: t.Optional(UnitReferencedBlockInputDocument),
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
		position: FractionalPosition,
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
	boundaryDocument: ZoneBoundaryResponseDocument,
	themeDocument: ZoneThemeResponseDocument,
	dockDocument: UnitReferencedBlockResponseDocument,
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
	key: t.String(),
	document: NavigationResponseDocument,
	position: FractionalPosition,
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const ZoneNavigationListResponse = t.Object({ items: t.Array(ZoneNavigationResponse) });

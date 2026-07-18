import { JsonValue } from "@rezics/portable-text";
import { ZoneBoundaryDocument, ZoneThemeDocument } from "@rezics/content-structure";
import { t } from "elysia";

import { DateTime, FractionalPosition, LocalizationInput, Uuid } from "../schema";

export const CreateSeriesBody = t.Object(
	{
		kind: t.String({ minLength: 1, maxLength: 64 }),
		slug: t.Optional(
			t.String({ minLength: 3, maxLength: 72, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
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
		managingRealmId: t.Optional(t.Nullable(Uuid)),
		slug: t.Optional(
			t.String({ minLength: 3, maxLength: 72, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
		),
		localization: LocalizationInput,
		boundaryDocument: ZoneBoundaryDocument,
		themeDocument: ZoneThemeDocument,
		startsAt: t.Optional(t.Nullable(t.String({ format: "date-time" }))),
		endsAt: t.Optional(t.Nullable(t.String({ format: "date-time" }))),
	},
	{ additionalProperties: false },
);
export const ZoneParams = t.Object({ zoneId: Uuid });

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

import Elysia from "elysia";
import { z } from "zod";
import session from "../../auth/session";
import { catalogRead, catalogMutation } from "./transaction";
import { CatalogMutationSchema } from "../../catalog/resource-contracts";
import { addMusicMedium, addMusicTrack } from "../../catalog/domains";
import { mutateMusicComponents } from "../../catalog/music-structure";
import {
	attachMusicDiscToc,
	listMusicDiscTocs,
	readMusicDiscToc,
	MusicDiscTocInputSchema,
} from "../../catalog/music-domain";
import {
	readMusicDetail,
	pageMusicMedia,
	pageMusicTracks,
	pageMusicHistory,
	pageMusicStructure,
	restoreMusicComponent,
	patchMusicHeader,
	patchMusicMedium,
	patchMusicTrack,
} from "../../catalog/music-api";
import {
	MusicStructureQuerySchema,
	MusicStructurePageSchema,
} from "../../catalog/music-api-contracts";
import {
	MusicDetailSchema,
	MusicMediaPageSchema,
	MusicTrackPageSchema,
	MusicPositionQuerySchema,
	MusicAddMediumSchema,
	MusicAddTrackSchema,
	MusicEditMediumSchema,
	MusicEditTrackSchema,
	MusicStructuralMutationSchema,
	MusicStructuralResultSchema,
	MusicHistoryQuerySchema,
	MusicHistoryPageSchema,
	MusicRestoreSchema,
	MusicHeaderPatchSchema,
	MusicDeleteSchema,
} from "../../catalog/music-api-contracts";
import { catalogWirePage } from "../../catalog/resource-pagination";

const root = z.strictObject({ id: z.uuid() }),
	medium = root.extend({ mediumId: z.uuid() }),
	track = root.extend({ trackId: z.uuid() });
const ref = (id: string) => ({ owner: "music" as const, id });
const created = CatalogMutationSchema.extend({ id: z.uuid() });
const page = z.strictObject({
	afterId: z.uuid().optional(),
	limit: z.coerce.number().int().min(1).max(50).default(25),
});
const toc = z.strictObject({
	id: z.uuid(),
	discId: z.string().nullable(),
	freeDbId: z.string().nullable(),
	trackCount: z.number().int(),
	leadoutOffset: z.number().int(),
});
/** @alpha Complete owner-local music authoring, album structure and exact history operations. */
export default new Elysia({ prefix: "/music", name: "native-music-api" })
	.use(session)
	.get(
		"/:id",
		{
			params: root,
			response: MusicDetailSchema,
			detail: {
				operationId: "readMusicDetail",
				tags: ["Music"],
				summary: "Read a native music object",
			},
		},
		({ params, request }) =>
			catalogRead(request, (tx, actor) => readMusicDetail(tx, params.id, actor)),
	)
	.patch(
		"/:id/metadata",
		{
			access: "contribute:unit:update",
			params: root,
			body: MusicHeaderPatchSchema,
			response: MusicStructuralResultSchema,
			detail: {
				operationId: "patchMusicMetadata",
				tags: ["Music"],
				summary: "Edit exact native music metadata",
			},
		},
		({ params, participation, body }) =>
			catalogMutation(participation, (tx, actor) => patchMusicHeader(tx, params.id, actor, body)),
	)
	.get(
		"/:id/media",
		{
			params: root,
			query: MusicPositionQuerySchema,
			response: MusicMediaPageSchema,
			detail: { operationId: "listMusicMedia", tags: ["Music"], summary: "Page album media" },
		},
		({ params, query, request }) =>
			catalogRead(request, (tx, actor) => pageMusicMedia(tx, params.id, actor, query)),
	)
	.post(
		"/:id/media",
		{
			access: "contribute:unit:update",
			params: root,
			body: MusicAddMediumSchema,
			response: created,
			detail: { operationId: "addMusicMedium", tags: ["Music"], summary: "Add an album medium" },
		},
		({ params, participation, body }) =>
			catalogMutation(participation, (tx, actor) =>
				addMusicMedium(tx, ref(params.id), actor, body.expectedRevision, {
					position: body.position,
					name: body.name,
					sourceTrackCount: body.sourceTrackCount,
				}),
			),
	)
	.patch(
		"/:id/media/:mediumId",
		{
			access: "contribute:unit:update",
			params: medium,
			body: MusicEditMediumSchema,
			response: MusicStructuralResultSchema,
			detail: { operationId: "patchMusicMedium", tags: ["Music"], summary: "Edit an exact medium" },
		},
		({ params, participation, body }) =>
			catalogMutation(participation, (tx, actor) =>
				patchMusicMedium(tx, params.id, params.mediumId, actor, body),
			),
	)
	.delete(
		"/:id/media/:mediumId",
		{
			access: "contribute:unit:update",
			params: medium,
			body: MusicDeleteSchema,
			response: MusicStructuralResultSchema,
			detail: {
				operationId: "removeMusicMedium",
				tags: ["Music"],
				summary: "Remove an empty album medium",
			},
		},
		({ params, participation, body }) =>
			catalogMutation(participation, (tx, actor) =>
				mutateMusicComponents(tx, ref(params.id), actor, body.expectedRevision, [
					{
						action: "remove",
						component: "music_medium",
						componentKey: params.mediumId,
						expectedRevisionId: body.expectedHeadId,
					},
				]),
			),
	)
	.get(
		"/:id/media/:mediumId/tracks",
		{
			params: medium,
			query: MusicPositionQuerySchema,
			response: MusicTrackPageSchema,
			detail: {
				operationId: "listMusicTracks",
				tags: ["Music"],
				summary: "Page a medium's track occurrences",
			},
		},
		({ params, query, request }) =>
			catalogRead(request, (tx, actor) =>
				pageMusicTracks(tx, params.id, params.mediumId, actor, query),
			),
	)
	.post(
		"/:id/media/:mediumId/tracks",
		{
			access: "contribute:unit:update",
			params: medium,
			body: MusicAddTrackSchema,
			response: created,
			detail: {
				operationId: "addMusicTrack",
				tags: ["Music"],
				summary: "Add a printed track occurrence",
			},
		},
		({ params, participation, body }) =>
			catalogMutation(participation, (tx, actor) =>
				addMusicTrack(tx, ref(params.id), actor, body.expectedRevision, {
					...body.value,
					mediumId: params.mediumId,
					recording: body.value.recordingId ? ref(body.value.recordingId) : undefined,
				}),
			),
	)
	.patch(
		"/:id/tracks/:trackId",
		{
			access: "contribute:unit:update",
			params: track,
			body: MusicEditTrackSchema,
			response: MusicStructuralResultSchema,
			detail: {
				operationId: "patchMusicTrack",
				tags: ["Music"],
				summary: "Edit an exact track occurrence",
			},
		},
		({ params, participation, body }) =>
			catalogMutation(participation, (tx, actor) =>
				patchMusicTrack(tx, params.id, params.trackId, actor, body),
			),
	)
	.delete(
		"/:id/tracks/:trackId",
		{
			access: "contribute:unit:update",
			params: track,
			body: MusicDeleteSchema,
			response: MusicStructuralResultSchema,
			detail: {
				operationId: "removeMusicTrack",
				tags: ["Music"],
				summary: "Remove an exact track occurrence",
			},
		},
		({ params, participation, body }) =>
			catalogMutation(participation, (tx, actor) =>
				mutateMusicComponents(tx, ref(params.id), actor, body.expectedRevision, [
					{
						action: "remove",
						component: "music_track_occurrence",
						componentKey: params.trackId,
						expectedRevisionId: body.expectedHeadId,
					},
				]),
			),
	)
	.get(
		"/:id/structure",
		{
			access: "contribute:unit:update",
			params: root,
			query: MusicStructureQuerySchema,
			response: MusicStructurePageSchema,
			detail: {
				operationId: "readMusicStructure",
				tags: ["Music"],
				summary: "Page live native music component values",
			},
		},
		({ params, participation, query }) =>
			catalogMutation(participation, (tx, actor) =>
				pageMusicStructure(tx, params.id, actor, query),
			),
	)
	.post(
		"/:id/structure",
		{
			access: "contribute:unit:update",
			params: root,
			body: MusicStructuralMutationSchema,
			response: MusicStructuralResultSchema,
			detail: {
				operationId: "mutateMusicStructure",
				tags: ["Music"],
				summary: "Apply a bounded exact music structure batch",
			},
		},
		({ params, participation, body }) =>
			catalogMutation(participation, (tx, actor) =>
				mutateMusicComponents(tx, ref(params.id), actor, body.expectedRevision, body.operations),
			),
	)
	.get(
		"/:id/history",
		{
			access: "contribute:unit:update",
			params: root,
			query: MusicHistoryQuerySchema,
			response: MusicHistoryPageSchema,
			detail: {
				operationId: "listMusicHistory",
				tags: ["Music"],
				summary: "Page exact music component history",
			},
		},
		({ params, query, participation }) =>
			catalogMutation(participation, (tx, actor) => pageMusicHistory(tx, params.id, actor, query)),
	)
	.post(
		"/:id/restore",
		{
			access: "contribute:unit:update",
			params: root,
			body: MusicRestoreSchema,
			response: MusicStructuralResultSchema,
			detail: {
				operationId: "restoreMusicComponent",
				tags: ["Music"],
				summary: "Restore one exact music component history value",
			},
		},
		({ params, participation, body }) =>
			catalogMutation(participation, (tx, actor) =>
				restoreMusicComponent(tx, params.id, actor, body),
			),
	)
	.post(
		"/:id/media/:mediumId/tocs",
		{
			access: "contribute:unit:update",
			params: medium,
			body: z.strictObject({
				expectedRevision: z.number().int().positive(),
				value: MusicDiscTocInputSchema,
			}),
			response: created,
			detail: {
				operationId: "attachMusicDiscToc",
				tags: ["Music"],
				summary: "Attach physical disc pressing evidence",
			},
		},
		({ params, participation, body }) =>
			catalogMutation(participation, (tx, actor) =>
				attachMusicDiscToc(
					tx,
					ref(params.id),
					actor,
					body.expectedRevision,
					params.mediumId,
					body.value,
				),
			),
	)
	.get(
		"/:id/media/:mediumId/tocs",
		{
			params: medium,
			query: page,
			response: z.strictObject({ items: z.array(toc).max(50), nextCursor: z.uuid().nullable() }),
			detail: {
				operationId: "listMusicDiscTocs",
				tags: ["Music"],
				summary: "Page physical disc pressing evidence",
			},
		},
		({ params, query, request }) =>
			catalogRead(request, async (tx, actor) =>
				catalogWirePage(
					(
						await listMusicDiscTocs(tx, ref(params.id), actor, params.mediumId, {
							...query,
							limit: query.limit + 1,
						})
					).map((value) => ({ id: value.id, value })),
					query.limit,
				),
			),
	)
	.get(
		"/:id/media/:mediumId/tocs/:tocId",
		{
			params: medium.extend({ tocId: z.uuid() }),
			response: toc.extend({ offsets: z.array(z.number().int()).max(99) }),
			detail: {
				operationId: "readMusicDiscToc",
				tags: ["Music"],
				summary: "Read a disc's exact physical offsets",
			},
		},
		({ params, request }) =>
			catalogRead(request, async (tx, actor) => {
				const value = await readMusicDiscToc(
					tx,
					ref(params.id),
					actor,
					params.mediumId,
					params.tocId,
				);
				return { ...value, discId: value.discId ?? null, freeDbId: value.freeDbId ?? null };
			}),
	);

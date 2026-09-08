import Elysia from "elysia";
import { z } from "zod";
import session from "../../auth/session";
import { catalogRead, catalogMutation } from "./transaction";
import { catalogDomainHistory } from "./domain-read";
import {
	ProgramDetailsSchema,
	ProgramEditSchema,
	ProgramMutationSchema,
	ProgramOccurrenceSchema,
	ProgramOccurrencePutSchema,
	ProgramOccurrenceRemoveSchema,
	ProgramPageQuerySchema,
	ProgramComponentSchema,
	ProgramHistorySchema,
	ProgramRestoreSchema,
	programPage,
} from "../../catalog/program-api-contracts";
import {
	readProgramApiDetails,
	editProgramApiDetails,
	pageProgramApiOccurrences,
	putProgramApiOccurrence,
	removeProgramApiOccurrence,
	pageProgramApiHistory,
	restoreProgramApiHistory,
} from "../../catalog/program-api";
const params = z.strictObject({ id: z.uuid() }),
	placement = params.extend({ occurrenceId: z.uuid() }),
	history = params.extend({ component: ProgramComponentSchema, componentKey: z.uuid() });
const detail = (operationId: string, summary: string) => ({
	operationId,
	summary,
	tags: ["Catalog Program"],
});
/** @alpha @remarks Native Program structures and ordered occurrences with exact independent history preconditions. */
export default new Elysia({ prefix: "/program", name: "catalog-program-api" })
	.use(session)
	.get(
		"/:id/details",
		{
			params,
			response: ProgramDetailsSchema,
			detail: detail("readProgramDetails", "Read a program, season, version or episode"),
		},
		({ params, request }) =>
			catalogRead(request, (tx, actor) => readProgramApiDetails(tx, params.id, actor)),
	)
	.put(
		"/:id/details",
		{
			access: "contribute:unit:update",
			params,
			body: ProgramEditSchema,
			response: ProgramMutationSchema,
			detail: detail("reviseProgramDetails", "Revise exact native Program fields"),
		},
		({ params, body, participation }) =>
			catalogMutation(participation, (tx, actor) =>
				editProgramApiDetails(tx, params.id, actor, body),
			),
	)
	.get(
		"/:id/occurrences",
		{
			params,
			query: ProgramPageQuerySchema,
			response: programPage(ProgramOccurrenceSchema),
			detail: detail("listProgramOccurrences", "List ordered episode appearances"),
		},
		({ params, query, request }) =>
			catalogRead(request, (tx, actor) => pageProgramApiOccurrences(tx, params.id, actor, query)),
	)
	.put(
		"/:id/occurrences/:occurrenceId",
		{
			access: "contribute:unit:update",
			params: placement,
			body: ProgramOccurrencePutSchema,
			response: ProgramMutationSchema,
			detail: detail("putProgramOccurrence", "Add or revise one episode appearance"),
		},
		({ params, body, participation }) =>
			catalogMutation(participation, (tx, actor) =>
				putProgramApiOccurrence(tx, params.id, actor, params.occurrenceId, body),
			),
	)
	.delete(
		"/:id/occurrences/:occurrenceId",
		{
			access: "contribute:unit:update",
			params: placement,
			body: ProgramOccurrenceRemoveSchema,
			response: ProgramMutationSchema,
			detail: detail(
				"removeProgramOccurrence",
				"Remove one episode appearance while retaining its history",
			),
		},
		({ params, body, participation }) =>
			catalogMutation(participation, (tx, actor) =>
				removeProgramApiOccurrence(tx, params.id, actor, params.occurrenceId, body),
			),
	)
	.get(
		"/:id/history/:component/:componentKey",
		{
			params: history,
			query: ProgramPageQuerySchema,
			response: programPage(ProgramHistorySchema),
			detail: detail(
				"listProgramComponentHistory",
				"Read authorized immutable Program component history",
			),
		},
		({ params, query, request }) =>
			catalogDomainHistory(request, { owner: "program", id: params.id }, (tx, actor) =>
				pageProgramApiHistory(tx, params.id, actor, params.component, params.componentKey, query),
			),
	)
	.post(
		"/:id/history/:component/:componentKey/restore",
		{
			access: "contribute:unit:update",
			params: history,
			body: ProgramRestoreSchema,
			response: ProgramMutationSchema,
			detail: detail(
				"restoreProgramComponent",
				"Restore a Program component against its exact current history",
			),
		},
		({ params, body, participation }) =>
			catalogMutation(participation, (tx, actor) =>
				restoreProgramApiHistory(tx, params.id, actor, params.component, params.componentKey, body),
			),
	);

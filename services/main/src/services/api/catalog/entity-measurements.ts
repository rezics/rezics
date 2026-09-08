import Elysia from "elysia";
import { z } from "zod";
import session from "../../auth/session";
import { EntityMeasurementContextQuerySchema, EntityMeasurementContextWriteSchema,
	EntityMeasurementContextResponseSchema, EntityMeasurementContextMutationSchema } from "../../catalog/entity-measurement-contracts";
import { readEntityMeasurementContext, writeEntityContextMeasurement } from "../../catalog/entity-context-measurements";
import { catalogRead, catalogMutation } from "./transaction";

const params = z.strictObject({ id: z.uuid() });
export default new Elysia({ prefix: "/entity/:id/measurements/context", name: "entity-context-measurements" }).use(session)
	.get("", { params, query: EntityMeasurementContextQuerySchema, response: EntityMeasurementContextResponseSchema,
		detail: { operationId: "readEntityMeasurementContext", summary: "Read character measurements in an exact content context", tags: ["Catalog"] } },
		({ params, query, request }) => catalogRead(request, (tx, actor) => readEntityMeasurementContext(tx, params.id, actor,
			{ owner: query.contextOwner, id: query.contextId }, query.maxSpoiler)))
	.put("", { access: "contribute:unit:update", params, body: EntityMeasurementContextWriteSchema, response: EntityMeasurementContextMutationSchema,
		detail: { operationId: "writeEntityMeasurementContext", summary: "Record or replace character measurements in an exact content context", tags: ["Catalog"] } },
		({ params, body, participation }) => catalogMutation(participation, (tx, actor) => writeEntityContextMeasurement(tx, params.id, actor, body)));

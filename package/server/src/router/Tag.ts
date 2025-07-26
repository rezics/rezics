import Tag from "contract/router/Tag";
import { TagCreate } from "database";
import { setup } from "./setup";

export default setup(({ gel, tsr }) =>
    tsr.router(Tag, {
        create: async ({ body, headers }) => {
            try {
                const result = await TagCreate(gel, {
                    name: body.name,
                    type: body.type,
                    owner: body.owner,
                });

                return {
                    status: 201,
                    body: {
                        id: result.id,
                        owner: result.owner.map((o) => o.id),
                        name: result.name,
                        type: result.type,
                        created_at: result.created_at,
                        updated_at: result.updated_at,
                        related_to: result.related_to.map((r) => r.id),
                        related_by: result.related_by.map((r) => r.id),
                    },
                };
            } catch (error) {
                return {
                    status: 500,
                    body: { error: String(error) },
                };
            }
        },
        update: async ({ body }) => {},
    }),
);

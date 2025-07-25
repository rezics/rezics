import s from "./s";
import c from "contract";
import d from "database";

export default s.router(c.Tag, {
    create: async ({ body }) => {
        d.insert(d.Tag, {
            name: body.name,
            owner: body.owner,
        });
        return {
            200: {},
        };
    },
});

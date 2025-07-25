import s from "./s";
import c from "contract";
import d from "database";

export default s.router(c.Tag, {
    create: async ({ body }) => {
        d.insert(d.CustomTag, {
            name: body.name,
            owner: d.select(d.User.i),
        });

        return {
            200: {},
        };
    },
});

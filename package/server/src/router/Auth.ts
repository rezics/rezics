import s from "./s";
import c from "contract";

export default s.router(c.Auth, {
    login: async ({ headers, body }) => {
        return {};
    },
});

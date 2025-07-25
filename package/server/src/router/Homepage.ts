import s from "./s";
import c from "contract";

export default s.router(c.Homepage, {
    get: async () => ({
        status: 200 as const,
        body: { id: "00000000-0000-0000-0000-000000000000", content: "" },
    }),
});
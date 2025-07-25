import s from "./s";
import c from "contract";

export default s.router(c.Chapter, {
    list: async () => ({
        status: 200 as const,
        body: { chapters: [], order: new Map() as any },
    }),
    get: async () => ({ status: 200 as const, body: {} as any }),
});
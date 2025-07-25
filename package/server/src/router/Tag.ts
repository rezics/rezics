import s from "./s";
import c from "contract";

export default s.router(c.Tag, {
    list: async () => ({ status: 200 as const, body: [] as any }),
    get: async () => ({ status: 200 as const, body: {} as any }),
    create: async () => ({ status: 200 as const, body: {} as any }),
    createTagGroup: async () => ({ status: 200 as const, body: {} as any }),
    updateTag: async () => ({ status: 200 as const, body: {} as any }),
    updateTagGroup: async () => ({ status: 200 as const, body: {} as any }),
    deleteTag: async () => ({ status: 200 as const, body: { message: "ok" } }),
    deleteTagGroup: async () => ({ status: 200 as const, body: { message: "ok" } }),
    deleteTagRelatedBook: async () => ({ status: 200 as const, body: { message: "ok" } }),
    deleteTagRelatedThread: async () => ({ status: 200 as const, body: { message: "ok" } }),
    bookRelatedTag: async () => ({ status: 200 as const, body: [] as any }),
    bookSpecificTagGroupTag: async () => ({ status: 200 as const, body: [] as any }),
    bookSpecificTagGroupListTag: async () => ({ status: 200 as const, body: [] as any }),
    threadRelatedTags: async () => ({ status: 200 as const, body: [] as any }),
});
import s from "./s";
import c from "contract";
import d from "database";

export default s.router(c.Chapter, {
    list: async ({ params: { bookId } }) => {
        try {
            const chapters = await d.select(d.Unit, (unit) => ({
                id: true,
                name: true,
                created_at: true,
                updated_at: true,
                order: unit.order,
                filter: d.op(unit.book.id, '=', d.uuid(bookId))
            }));

            return {
                status: 200,
                body: {
                    chapters: chapters,
                    order: chapters.map(c => ({ id: c.id, order: c.order }))
                }
            };
        } catch (error) {
            return {
                status: 200,
                body: {
                    chapters: [],
                    order: []
                }
            };
        }
    },

    get: async ({ params: { bookId, chapterId } }) => {
        try {
            const chapter = await d.select(d.Unit, (unit) => ({
                id: true,
                name: true,
                created_at: true,
                updated_at: true,
                order: unit.order,
                filter: d.op(
                    d.op(unit.book.id, '=', d.uuid(bookId)),
                    'and',
                    d.op(unit.id, '=', d.uuid(chapterId))
                )
            }));

            if (!chapter[0]) {
                return {
                    status: 404,
                    body: { message: "Chapter not found" }
                };
            }

            return {
                status: 200,
                body: chapter[0]
            };
        } catch (error) {
            return {
                status: 404,
                body: { message: "Chapter not found" }
            };
        }
    }
});

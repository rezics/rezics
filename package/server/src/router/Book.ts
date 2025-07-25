import s from "./s";
import c from "contract";
import { createClient } from "database";
import { randomBytes } from "crypto";

// Create a client once for this module – connection details come from env vars (see EdgeDB docs)
const db = createClient();

export default s.router(c.Book, {
    // GET /book/:bookId
    get: async ({ params }) => {
        const { bookId } = params;
        try {
            const rows = await db.query(
                `select default::Book {
                    id,
                    created_at,
                    updated_at,
                    up := array_unpack(array[]<uuid>),
                    down := array_unpack(array[]<uuid>),
                    favorites := array_unpack(array[]<uuid>)
                } filter .id = <uuid>$bookId limit 1`,
                { bookId },
            );

            if (rows.length === 0) {
                return { status: 404 as const, body: { message: "Book not found" } };
            }

            const b = rows[0] as any;
            return {
                status: 200 as const,
                body: {
                    id: b.id,
                    icsId: `BK-${b.id.replace(/-/g, "").slice(0, 24)}`,
                    created_at: b.created_at,
                    updated_at: b.updated_at,
                    up: b.up ?? [],
                    down: b.down ?? [],
                    favorites: b.favorites ?? [],
                },
            };
        } catch (err) {
            console.error(err);
            return { status: 404 as const, body: { message: "Book not found" } };
        }
    },

    // PUT /book/:id
    update: async ({ params, body }) => {
        const { id } = params;
        const setters: string[] = [];
        const args: Record<string, any> = { id };
        if (body.name !== undefined) {
            setters.push("name := <str>$name");
            args.name = body.name;
        }
        if (body.description !== undefined) {
            setters.push("description := <str>$description");
            args.description = body.description;
        }
        if (setters.length === 0) {
            return { status: 404 as const, body: { message: "Nothing to update" } };
        }
        const query = `update default::Book filter .id = <uuid>$id set { ${setters.join(",")} }`;
        await db.execute(query, args);
        // Return the updated view
        const rows = await db.query(
            `select default::Book { id, created_at, updated_at } filter .id = <uuid>$id limit 1`,
            { id },
        );
        const b = rows[0] as any;
        return {
            status: 200 as const,
            body: {
                id: b.id,
                icsId: `BK-${b.id.replace(/-/g, "").slice(0, 24)}`,
                created_at: b.created_at,
                updated_at: b.updated_at,
                up: [],
                down: [],
                favorites: [],
            },
        };
    },

    // GET /book/list
    list: async ({ query }) => {
        const { page = 1, limit = 10, q } = query as any;
        const offset = (page - 1) * limit;
        const filter = q ? `filter .name ilike '%' ++ <str>$q ++ '%'
        ` : "";
        const totalItems: number = await db.querySingle(
            `select count(default::Book ${filter})`,
            { q },
        );
        const books = await db.query(
            `select default::Book { id, created_at, updated_at } ${filter} order by .created_at desc offset <int64>$offset limit <int64>$limit`,
            { q, offset, limit },
        );
        const items = books.map((b: any) => ({
            id: b.id,
            icsId: `BK-${b.id.replace(/-/g, "").slice(0, 24)}`,
            created_at: b.created_at,
            updated_at: b.updated_at,
            up: [],
            down: [],
            favorites: [],
        }));
        return {
            status: 200 as const,
            body: {
                items,
                page,
                totalItems,
            },
        };
    },
});
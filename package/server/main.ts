import type { InputUnion } from "contract";
import { EdgeQL as e } from "database";
import { createClient } from "gel";
import { Hono } from "hono";
import { selectToEdgeQL } from "./src/selectToEdgeQL.ts";

function nonNull<T>(value: T | undefined | null): value is T {
	return value !== undefined && value !== null;
}

function buildUpdateSet<T extends Record<string, unknown>>(
	param: T,
	ignore: string[],
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(param)
			.filter(([k, v]) => !ignore.includes(k) && nonNull(v))
			.map(([k, v]) => [k, v]),
	);
}

const cfg = {
	host: Deno.env.get("HOST") || "localhost",
	port: Number(Deno.env.get("PORT") || 8080),
} as const;

const gc = createClient();

const srv = new Hono();

srv.post("/", async (c) => {
	const req: InputUnion = await c.req.json();

	switch (req.operation) {
		/* ---------------- Tag ---------------- */
		case "tag.create": {
			// 插入 Tag
			const inserted = await e.insert(e.Tag, {
				name: (req as any).parameter.name,
				type: (req as any).parameter.type,
			}).run(gc);

			// 追加 owners（逐个追加，EdgeQL JS 使用 "+=" 语法需要写成 { owned_tags: { "+=": expr } }
			const owners: string[] = ((req as any).parameter.owners || []).map((
				o: any,
			) => o.id).filter(Boolean);
			if (owners.length) {
				const tagExpr = e.select(e.Tag, (t) => ({
					filter: e.op(t.id, "=", inserted.id),
					id: true,
				}));
				await Promise.all(
					owners.map((oid) =>
						e.update(e.User, (u) => ({
							filter: e.op(u.id, "=", e.uuid(oid)),
							set: {
								owned_tags: { "+=": tagExpr },
							},
						})).run(gc)
					),
				);
			}

			const selected = await e.select(e.Tag, (tag) => ({
				filter: e.op(tag.id, "=", inserted.id),
				...selectToEdgeQL((req as any).select),
			})).run(gc);
			return c.json(selected);
		}
		case "tag.read": {
			const id = (req as any).parameter.id;
			const selected = await e.select(e.Tag, (tag) => ({
				filter: e.op(tag.id, "=", e.uuid(id)),
				...selectToEdgeQL((req as any).select),
			})).run(gc);
			return c.json(selected);
		}
		case "tag.update": {
			const { id, ...rest } = (req as any).parameter;
			const setObj = buildUpdateSet(rest, []);
			if (Object.keys(setObj).length) {
				await e.update(e.Tag, (tag) => ({
					filter: e.op(tag.id, "=", e.uuid(id)),
					set: setObj,
				})).run(gc);
			}
			const selected = await e.select(e.Tag, (tag) => ({
				filter: e.op(tag.id, "=", e.uuid(id)),
				...selectToEdgeQL((req as any).select),
			})).run(gc);
			return c.json(selected);
		}
		case "tag.delete": {
			const id = (req as any).parameter.id;
			const before = await e.select(e.Tag, (tag) => ({
				filter: e.op(tag.id, "=", e.uuid(id)),
				...selectToEdgeQL((req as any).select),
			})).run(gc);
			await e.delete(e.Tag, (tag) => ({
				filter: e.op(tag.id, "=", e.uuid(id)),
			})).run(gc);
			return c.json(before);
		}

		/* ---------------- User ---------------- */
		case "user.create": {
			const inserted = await e.insert(e.User, {
				name: (req as any).parameter.name,
				email: (req as any).parameter.email,
			}).run(gc);
			const selected = await e.select(e.User, (user) => ({
				filter: e.op(user.id, "=", inserted.id),
				...selectToEdgeQL((req as any).select),
			})).run(gc);
			return c.json(selected);
		}
		case "user.read": {
			const id = (req as any).parameter.id;
			const selected = await e.select(e.User, (user) => ({
				filter: e.op(user.id, "=", e.uuid(id)),
				...selectToEdgeQL((req as any).select),
			})).run(gc);
			return c.json(selected);
		}
		case "user.update": {
			const { id, ...rest } = (req as any).parameter;
			const setObj = buildUpdateSet(rest, []);
			if (Object.keys(setObj).length) {
				await e.update(e.User, (user) => ({
					filter: e.op(user.id, "=", e.uuid(id)),
					set: setObj,
				})).run(gc);
			}
			const selected = await e.select(e.User, (user) => ({
				filter: e.op(user.id, "=", e.uuid(id)),
				...selectToEdgeQL((req as any).select),
			})).run(gc);
			return c.json(selected);
		}
		case "user.delete": {
			const id = (req as any).parameter.id;
			const before = await e.select(e.User, (user) => ({
				filter: e.op(user.id, "=", e.uuid(id)),
				...selectToEdgeQL((req as any).select),
			})).run(gc);
			await e.delete(e.User, (user) => ({
				filter: e.op(user.id, "=", e.uuid(id)),
			})).run(gc);
			return c.json(before);
		}

		/* ---------------- Author ---------------- */
		case "author.create": {
			const inserted = await e.insert(e.Author, {
				name: (req as any).parameter.name,
			}).run(gc);
			const selected = await e.select(e.Author, (author) => ({
				filter: e.op(author.id, "=", inserted.id),
				...selectToEdgeQL((req as any).select),
			})).run(gc);
			return c.json(selected);
		}
		case "author.read": {
			const id = (req as any).parameter.id;
			const selected = await e.select(e.Author, (author) => ({
				filter: e.op(author.id, "=", e.uuid(id)),
				...selectToEdgeQL((req as any).select),
			})).run(gc);
			return c.json(selected);
		}
		case "author.update": {
			const { id, ...rest } = (req as any).parameter;
			const setObj = buildUpdateSet(rest, []);
			if (Object.keys(setObj).length) {
				await e.update(e.Author, (author) => ({
					filter: e.op(author.id, "=", e.uuid(id)),
					set: setObj,
				})).run(gc);
			}
			const selected = await e.select(e.Author, (author) => ({
				filter: e.op(author.id, "=", e.uuid(id)),
				...selectToEdgeQL((req as any).select),
			})).run(gc);
			return c.json(selected);
		}
		case "author.delete": {
			const id = (req as any).parameter.id;
			const before = await e.select(e.Author, (author) => ({
				filter: e.op(author.id, "=", e.uuid(id)),
				...selectToEdgeQL((req as any).select),
			})).run(gc);
			await e.delete(e.Author, (author) => ({
				filter: e.op(author.id, "=", e.uuid(id)),
			})).run(gc);
			return c.json(before);
		}

		/* ---------------- Chapter ---------------- */
		case "chapter.create": {
			const { name, book } = (req as any).parameter;
			if (!book?.id) {
				return c.json({ error: "chapter.create missing book.id" }, 400);
			}
			const inserted = await e.insert(e.Chapter, {
				name,
				book: e.select(
					e.Book,
					(b) => ({
						filter_single: e.op(b.id, "=", e.uuid(book.id)),
						id: true,
					}),
				),
			}).run(gc);
			const selected = await e.select(e.Chapter, (chapter) => ({
				filter: e.op(chapter.id, "=", inserted.id),
				...selectToEdgeQL((req as any).select),
			})).run(gc);
			return c.json(selected);
		}
		case "chapter.read": {
			const id = (req as any).parameter.id;
			const selected = await e.select(e.Chapter, (chapter) => ({
				filter: e.op(chapter.id, "=", e.uuid(id)),
				...selectToEdgeQL((req as any).select),
			})).run(gc);
			return c.json(selected);
		}
		case "chapter.update": {
			const { id, ...rest } = (req as any).parameter;
			const setObj = buildUpdateSet(rest, []);
			if (Object.keys(setObj).length) {
				await e.update(e.Chapter, (chapter) => ({
					filter: e.op(chapter.id, "=", e.uuid(id)),
					set: setObj,
				})).run(gc);
			}
			const selected = await e.select(e.Chapter, (chapter) => ({
				filter: e.op(chapter.id, "=", e.uuid(id)),
				...selectToEdgeQL((req as any).select),
			})).run(gc);
			return c.json(selected);
		}
		case "chapter.delete": {
			const id = (req as any).parameter.id;
			const before = await e.select(e.Chapter, (chapter) => ({
				filter: e.op(chapter.id, "=", e.uuid(id)),
				...selectToEdgeQL((req as any).select),
			})).run(gc);
			await e.delete(e.Chapter, (chapter) => ({
				filter: e.op(chapter.id, "=", e.uuid(id)),
			})).run(gc);
			return c.json(before);
		}

		/* ---------------- Book ---------------- */
		case "book.create": {
			const { name } = (req as any).parameter;
			const inserted = await e.insert(e.Book, {
				name,
				length: 0,
				grabbed_from: "manual",
			}).run(gc) as any;
			const selected = await e.select(e.Book, (book) => ({
				filter: e.op(book.id, "=", inserted.id),
				...selectToEdgeQL((req as any).select),
			})).run(gc);
			return c.json(selected);
		}
		case "book.read": {
			const id = (req as any).parameter.id;
			const selected = await e.select(e.Book, (book) => ({
				filter: e.op(book.id, "=", e.uuid(id)),
				...selectToEdgeQL((req as any).select),
			})).run(gc);
			return c.json(selected);
		}
		case "book.update": {
			const { id, ...rest } = (req as any).parameter;
			const setObj = buildUpdateSet(rest, []);
			if (Object.keys(setObj).length) {
				await e.update(e.Book, (book) => ({
					filter: e.op(book.id, "=", e.uuid(id)),
					set: setObj,
				})).run(gc);
			}
			const selected = await e.select(e.Book, (book) => ({
				filter: e.op(book.id, "=", e.uuid(id)),
				...selectToEdgeQL((req as any).select),
			})).run(gc);
			return c.json(selected);
		}
		case "book.delete": {
			const id = (req as any).parameter.id;
			const before = await e.select(e.Book, (book) => ({
				filter: e.op(book.id, "=", e.uuid(id)),
				...selectToEdgeQL((req as any).select),
			})).run(gc);
			await e.delete(e.Book, (book) => ({
				filter: e.op(book.id, "=", e.uuid(id)),
			})).run(gc);
			return c.json(before);
		}
		default:
			return c.json({ error: "Unsupported operation" }, 400);
	}
});

Deno.serve({
	hostname: cfg.host,
	port: cfg.port,
}, srv.fetch);

import { HttpResponse } from "msw";
import { bookList01 } from "../data/bookList01.ts";
import { bookInfo01 } from "../data/bookinfo01.ts";
import { generateRandomItemsFrom } from "./common.ts";

const books = [...bookList01];

// ===== Operation-based handlers =====

const bookStore = new Map<string, any>();

function genId() {
	return Math.random().toString(36).slice(2, 10);
}

export function bookCreateHandler(body: any) {
	const id = genId();
	const now = new Date().toISOString();
	const created = {
		id,
		title: body?.parameter?.title ?? "Untitled Book",
		authors: body?.parameter?.authors ?? [],
		created_at: now,
		updated_at: now,
	};
	bookStore.set(id, created);
	return HttpResponse.json({ id: created.id, title: created.title }, {
		status: 200,
	});
}

export function bookReadHandler(body: any) {
	const id = body?.parameter?.id;
	const found = id ? bookStore.get(id) : undefined;
	// @ts-ignore no use payload
	const _payload = found ?? bookInfo01;
	// Return minimal common fields for flexibility
	// const result = {
	//     id: payload.id ?? id ?? genId(),
	//     title: payload.title ?? payload.name ?? "",
	// };
	const result = bookInfo01;
	return HttpResponse.json({ ...result }, { status: 200 });
}

export function bookUpdateHandler(body: any) {
	const id = body?.parameter?.id;
	const prev = id ? bookStore.get(id) : undefined;
	if (!prev) {
		const now = new Date().toISOString();
		const created = {
			id: id ?? genId(),
			title: body?.parameter?.title ?? "",
			authors: body?.parameter?.authors ?? [],
			created_at: now,
			updated_at: now,
		};
		bookStore.set(created.id, created);
		return HttpResponse.json({ id: created.id, title: created.title }, {
			status: 200,
		});
	}
	const updated = {
		...prev,
		...body?.parameter,
		updated_at: new Date().toISOString(),
	};
	bookStore.set(updated.id, updated);
	return HttpResponse.json({ id: updated.id, title: updated.title }, {
		status: 200,
	});
}

export function bookDeleteHandler(body: any) {
	const id = body?.parameter?.id;
	if (id) bookStore.delete(id);
	return HttpResponse.json({ success: { id } }, { status: 200 });
}

export function bookListHandler(body: any) {
	const page = body?.parameter?.query?.page ?? 1;
	const limit = body?.parameter?.query?.limit ?? 5;
	const items = generateRandomItemsFrom(books, Number(limit) || 5);
	return HttpResponse.json({ items, page, totalItems: 10000 }, {
		status: 200,
	});
}

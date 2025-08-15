import { HttpResponse } from "msw";
import { mockBookLists } from "../data/booklists.ts";
import { mockABookList01 } from "../data/abooklist01.ts";

// operation: "readlist.list"
export function readlistListHandler(body: any) {
	const page = Number(body?.parameter?.page ?? 1);
	const limit = Number(body?.parameter?.limit ?? 20);
	const start = (page - 1) * limit;
	const items = mockBookLists.slice(start, start + limit);
	return HttpResponse.json({
		items,
		page,
		totalPages: 1,
		total: mockBookLists.length,
	}, { status: 200 });
}

// operation: "readlist.read"
export function readlistReadHandler(_body: any) {
	const list = mockABookList01;
	return HttpResponse.json({ ...list }, { status: 200 });
}

// operation: "readlist.create"
export function readlistCreateHandler(body: any) {
	const payload = body?.parameter ?? {};
	const newList = {
		id: String(mockBookLists.length + 1),
		...(payload as any),
		creator: {
			name: "Mock User",
			avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=user",
		},
		likes: 0,
	} as any;
	mockBookLists.push(newList);
	return HttpResponse.json(newList, { status: 201 });
}

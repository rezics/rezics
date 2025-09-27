import { http, HttpResponse } from "msw";
import { genId, toInt, toNonNegativeInt } from "../lib";

const userInfo = {
  id: "1",
  name: "John Doe",
  avatar:
    "https://styles.redditmedia.com/t5_2hyqpk/styles/communityIcon_x6pum2tm8hbd1.png?width=128&frame=1&auto=webp&s=e5904cf74875c0df8fcd42c8bc95fe06304e052c",
  bio:
    "This is a short bio describing the user. It can include interests, background, or any other relevant information.",
  joinDate: "2022-01-15",
};

const userStore = new Map<string, any>();

export const userHttpHandlers = [
  http.get("/api/users/me", () => HttpResponse.json(userInfo, { status: 200 })),
  http.get("/api/users", ({ request }) => {
    const url = new URL(request.url);
    const offset = toNonNegativeInt(url.searchParams.get("offset"), 0);
    const limit = toInt(url.searchParams.get("limit"), 20);
    const list = Array.from(userStore.values());
    const totalItems = list.length;
    const items = list.slice(offset, offset + limit);
    return HttpResponse.json({ items, offset, totalItems }, { status: 200 });
  }),
  http.get("/api/users/:id", ({ params }) => {
    const user = userStore.get(String((params as any).id));
    if (!user) return HttpResponse.json({ message: "Not Found" }, { status: 404 });
    return HttpResponse.json(user, { status: 200 });
  }),
  http.post("/api/users", async ({ request }) => {
    const payload = (await request.json().catch(() => ({}))) as any;
    const created = { id: genId(), name: payload?.name ?? "Anonymous", avatar: payload?.avatar, bio: payload?.bio };
    userStore.set(created.id, created);
    return HttpResponse.json(created, { status: 201 });
  }),
  http.patch("/api/users/:id", async ({ params, request }) => {
    const id = String((params as any).id);
    const prev = userStore.get(id) ?? { id };
    const payload = (await request.json().catch(() => ({}))) as any;
    const next = { ...prev, ...(payload as any) };
    userStore.set(id, next);
    return HttpResponse.json(next, { status: 200 });
  }),
  http.delete("/api/users/:id", ({ params }) => {
    const id = String((params as any).id);
    userStore.delete(id);
    return HttpResponse.json({}, { status: 204 });
  }),
];

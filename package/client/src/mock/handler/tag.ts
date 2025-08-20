import { HttpResponse } from "msw";

// Simple in-memory store for tags to make read/update/delete meaningful in mocks
const tagStore = new Map<string, any>();

function genId() {
    return Math.random().toString(36).slice(2, 10);
}

export function tagCreateHandler(body: any) {
    const id = genId();
    const now = new Date().toISOString();
    const created = {
        id,
        name: body?.parameter?.name ?? "New Tag",
        type: body?.parameter?.type ?? "general",
        owners: body?.parameter?.owners ?? [],
        created_at: now,
        updated_at: now,
    };
    tagStore.set(id, created);
    return HttpResponse.json({ id: created.id, name: created.name }, {
        status: 200,
    });
}

export function tagReadHandler(body: any) {
    const id = body?.parameter?.id;
    const found = id ? tagStore.get(id) : undefined;
    if (!found) {
        const result = { id, name: "" };
        return HttpResponse.json({ ...result }, { status: 200 });
    }
    const result = { id: found.id, name: found.name };
    return HttpResponse.json({ ...result }, { status: 200 });
}

export function tagUpdateHandler(body: any) {
    const id = body?.parameter?.id;
    const prev = id ? tagStore.get(id) : undefined;
    if (!prev) {
        // Upsert-like behavior for mocks
        const now = new Date().toISOString();
        const created = {
            id: id ?? genId(),
            name: body?.parameter?.name ?? "",
            type: body?.parameter?.type ?? "general",
            owners: body?.parameter?.owners ?? [],
            created_at: now,
            updated_at: now,
        };
        tagStore.set(created.id, created);
        return HttpResponse.json({ id: created.id, name: created.name }, {
            status: 200,
        });
    }
    const updated = {
        ...prev,
        ...body?.parameter,
        updated_at: new Date().toISOString(),
    };
    tagStore.set(updated.id, updated);
    return HttpResponse.json({ id: updated.id, name: updated.name }, {
        status: 200,
    });
}

export function tagDeleteHandler(body: any) {
    const id = body?.parameter?.id;
    if (id) tagStore.delete(id);
    // Return minimal selected fields
    return HttpResponse.json({ id }, { status: 200 });
}

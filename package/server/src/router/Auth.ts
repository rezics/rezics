import s from "./s";
import c from "contract";
import { createClient } from "database";
import { randomBytes } from "crypto";

const db = createClient();

const toUserView = (u: any) => ({
    id: u.id,
    username: u.name ?? u.email.split("@")[0],
    email: u.email,
    phone: undefined,
    name: u.name ?? "",
    avatar: undefined,
    created_at: u.created_at?.toISOString?.() ?? new Date().toISOString(),
    updated_at: u.updated_at?.toISOString?.() ?? new Date().toISOString(),
});

export default s.router(c.Auth, {
    login: async ({ body }) => {
        const { email } = body;
        const users = await db.query(
            `select default::User { id, name, email, created_at, updated_at } filter .email = <str>$email limit 1`,
            { email },
        );
        if (users.length === 0) {
            return { status: 401 as const, body: { message: "Invalid credentials" } };
        }
        const user = users[0];
        const token = randomBytes(32).toString("hex");
        return { status: 200 as const, body: { token, user: toUserView(user) } };
    },

    register: async ({ body }) => {
        const { email } = body;
        const name = email.split("@")[0];
        const existing = await db.query(
            `select default::User filter .email = <str>$email limit 1`,
            { email },
        );
        let user;
        if (existing.length === 0) {
            const inserted = await db.query(
                `insert default::User { name := <str>$name, email := <str>$email }`,
                { name, email },
            );
            user = inserted[0];
        } else {
            user = existing[0];
        }
        const token = randomBytes(32).toString("hex");
        return { status: 200 as const, body: { token, user: toUserView(user) } };
    },

    refresh: async () => {
        const accessToken = randomBytes(32).toString("hex");
        const refreshToken = randomBytes(32).toString("hex");
        return { status: 200 as const, body: { accessToken, refreshToken } };
    },
});

// lib/authBearer.ts
import { tokenStore } from "./swr.ts";

export async function login(username: string, password: string) {
	const res = await fetch("/auth/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username, password }),
	});
	if (!res.ok) throw new Error("Login failed");
	const data = await res.json(); // { accessToken, refreshToken? }
	tokenStore.set(data.accessToken);
}

export function logout() {
	tokenStore.set(null);
	fetch("/auth/logout", { method: "POST" }); // 可选
}

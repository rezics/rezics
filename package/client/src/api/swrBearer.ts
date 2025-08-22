// lib/swrBearer.ts
import type { Middleware } from "swr";
import { apiPost } from "./swr.ts";
import { tokenStore } from "./swr.ts";

let refreshing: Promise<void> | null = null;

async function refreshToken() {
	if (!refreshing) {
		refreshing = (async () => {
			const res = await fetch("/auth/refresh", { method: "POST" });
			if (!res.ok) throw new Error("Refresh failed");
			const data = await res.json(); // { accessToken: "..." }
			tokenStore.set(data.accessToken);
		})().finally(() => {
			refreshing = null;
		});
	}
	return refreshing;
}

export const withBearer: Middleware =
	(useSWRNext) => <Data = any>(key: any, fetcher: any, config: any) => {
		const wrappedFetcher = async (...args: any[]): Promise<Data> => {
			try {
				return await (fetcher ?? apiPost)(...(args as [string]));
			} catch (e: any) {
				if (e?.status === 401) {
					await refreshToken();
					return await (fetcher ?? apiPost)(...(args as [string]));
				}
				throw e;
			}
		};
		return useSWRNext(key, wrappedFetcher, {
			...config,
			shouldRetryOnError: false,
		});
	};

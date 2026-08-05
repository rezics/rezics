import { createClient, type ClientInstance } from "./generated/.kubb/client";

declare const rezicsApiTokenBrand: unique symbol;

/** A non-empty API token that has been validated without exposing its value. */
export type RezicsApiToken = string & { readonly [rezicsApiTokenBrand]: true };

export type RezicsApiTokenProvider = () => RezicsApiToken | Promise<RezicsApiToken>;

export type CreateRezicsClientOptions = {
	/** API origin, for example `https://api.rezics.com`. */
	baseUrl: string | URL;
	/** Prefer a provider so the credential stays at the environment boundary. */
	token: RezicsApiToken | RezicsApiTokenProvider;
};

/**
 * Validate a token read from an environment variable. The token is never included in an error.
 */
export function apiTokenFromEnv(value: string | undefined): RezicsApiToken {
	if (!value || value.trim().length === 0) {
		throw new Error("REZICS API token is missing");
	}
	if (/\s/u.test(value)) {
		throw new Error("REZICS API token contains whitespace");
	}
	return value as RezicsApiToken;
}

function normalizeBaseUrl(value: string | URL): string {
	const url = new URL(value);
	if (url.username || url.password) {
		throw new Error("REZICS API base URL must not contain credentials");
	}

	const isLoopback =
		url.hostname === "localhost" ||
		url.hostname === "127.0.0.1" ||
		url.hostname === "[::1]" ||
		url.hostname === "::1";
	if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) {
		throw new Error("REZICS API base URL must use HTTPS except on loopback hosts");
	}

	url.pathname = url.pathname.replace(/\/+$/u, "");
	url.search = "";
	url.hash = "";
	return url.toString().replace(/\/$/u, "");
}

/** Create an isolated bearer-token client. It never sends browser session cookies. */
export function createRezicsClient(options: CreateRezicsClientOptions): ClientInstance {
	const token = options.token;
	const provideToken: RezicsApiTokenProvider = typeof token === "function" ? token : () => token;
	const baseUrl = normalizeBaseUrl(options.baseUrl);
	const baseOrigin = new URL(baseUrl).origin;

	const client = createClient({
		baseURL: baseUrl,
		credentials: "omit",
		auth: async (scheme) => {
			if (scheme.type !== "http" || scheme.scheme !== "bearer") return undefined;
			return provideToken();
		},
	});
	client.interceptors.request.use(async (request) => {
		if (new URL(request.url).origin !== baseOrigin)
			throw new Error("REZICS API client refused to send credentials to another origin");
		const headers = new Headers(request.headers);
		headers.set("Authorization", `Bearer ${await provideToken()}`);
		return { ...request, headers: Object.fromEntries(headers.entries()) };
	});
	return client;
}

export * from "./generated/.kubb/client";
export * from "./generated/client";
export * from "./generated/models";

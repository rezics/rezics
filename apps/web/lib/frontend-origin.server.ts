const LocalFrontendOrigin = "http://localhost:3000";

export function getFrontendOrigin(): URL {
	const value =
		process.env.FRONTEND_URL?.trim() ||
		process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
			.map((origin) => origin.trim())
			.find(Boolean);
	if (!value && process.env.NODE_ENV === "production")
		throw new Error("FRONTEND_URL is required in production");

	const url = new URL(value || LocalFrontendOrigin);
	if (url.protocol !== "http:" && url.protocol !== "https:")
		throw new Error("FRONTEND_URL must use HTTP or HTTPS");
	if (url.pathname !== "/" || url.search || url.hash)
		throw new Error("FRONTEND_URL must be an origin without a path, query, or fragment");
	return url;
}

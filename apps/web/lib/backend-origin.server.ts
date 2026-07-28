const LocalApiOrigin = "http://localhost:3001";

export function getBackendOrigin(): URL {
	const value = process.env.REZICS_API_ORIGIN?.trim();
	if (!value && process.env.NODE_ENV === "production")
		throw new Error("REZICS_API_ORIGIN is required in production");

	const url = new URL(value || LocalApiOrigin);
	if (url.protocol !== "http:" && url.protocol !== "https:")
		throw new Error("REZICS_API_ORIGIN must use HTTP or HTTPS");
	if (url.pathname !== "/" || url.search || url.hash)
		throw new Error("REZICS_API_ORIGIN must be an origin without a path, query, or fragment");
	return url;
}

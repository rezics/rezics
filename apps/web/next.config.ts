import type { NextConfig } from "vinext";

const nextConfig = {
	experimental: {
		authInterrupts: true,
	},
	async headers() {
		return [
			{
				source: "/manifest.webmanifest",
				headers: [
					{ key: "Content-Type", value: "application/manifest+json; charset=utf-8" },
					{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
				],
			},
			{
				source: "/sw.js",
				headers: [
					{ key: "Content-Type", value: "application/javascript; charset=utf-8" },
					{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
					{
						key: "Content-Security-Policy",
						value: "default-src 'self'; script-src 'self'",
					},
					{ key: "Service-Worker-Allowed", value: "/" },
					{ key: "X-Content-Type-Options", value: "nosniff" },
				],
			},
		];
	},
} satisfies NextConfig;

export default nextConfig;

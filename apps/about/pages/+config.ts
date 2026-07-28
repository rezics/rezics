import vikeReact from "vike-react/config";
import type { Config } from "vike/types";

export default {
	extends: vikeReact,
	ssr: true,
	prerender: true,
	clientRouting: true,
	trailingSlash: true,
	passToClient: ["data", "is404", "statusCode"],
} satisfies Config;

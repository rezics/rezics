import { serve } from "srvx";

import api from "./services/api";
import { env } from "./services/config";

serve({
	fetch: api.fetch,
	gracefulShutdown: {
		gracefulTimeout: 10_000,
		forceTimeout: 30_000,
	},
	hostname: env.HOST,
	port: env.PORT,
});

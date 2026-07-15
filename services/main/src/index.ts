import { serve } from "srvx";

import api from "./services/api";
import { env } from "./services/config";

export default serve({
	fetch: api.fetch,
	hostname: env.HOST,
	port: env.PORT,
});

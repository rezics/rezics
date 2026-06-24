import "dotenv/config";

import { logStartupBanner } from "@rezics/shared/observability";
import { createServerApp } from "./app";

const { app, observability, port } = await createServerApp();

app.listen(port);
logStartupBanner(observability);

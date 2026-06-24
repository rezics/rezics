import "dotenv/config";

import { logStartupBanner } from "@rezics/shared/observability";
import { createBackendApp } from "./app";

const { app, observability, port } = await createBackendApp();

app.listen(port);
logStartupBanner(observability);

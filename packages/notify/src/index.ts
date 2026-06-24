import "dotenv/config";

import { logStartupBanner } from "@rezics/shared/observability";
import { createNotifyApp } from "./app";

const { app, observability, port } = await createNotifyApp();

app.listen(port);
logStartupBanner(observability);

import "dotenv/config";

import { logStartupBanner } from "@rezics/shared/observability";
import { createReactionApp } from "./app";

const { app, observability, port } = await createReactionApp();

app.listen(port);
logStartupBanner(observability);

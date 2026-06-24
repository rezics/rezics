import "dotenv/config";

import { logStartupBanner } from "@rezics/shared/observability";
import { createRankingApp } from "./app";

const { app, observability, port } = await createRankingApp();

app.listen(port);
logStartupBanner(observability);

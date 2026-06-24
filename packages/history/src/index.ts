import "dotenv/config";

import { logStartupBanner } from "@rezics/shared/observability";
import { createHistoryApp } from "./app";

const { app, observability, port } = await createHistoryApp();

app.listen(port);
logStartupBanner(observability);

export { app };

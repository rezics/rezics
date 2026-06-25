import { logStartupBanner } from "@/internal/shared/observability";
import { createAuthApp } from "./app";

const { app, observability, port } = await createAuthApp();

app.listen(port);
logStartupBanner(observability);

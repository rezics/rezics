import { runCluster } from "@rezics/shared/cluster";

await runCluster(() => import("./index"), { serviceName: "auth" });

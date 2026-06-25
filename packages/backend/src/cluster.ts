import { runCluster } from "@/internal/shared/cluster";

await runCluster(() => import("./index"), { serviceName: "backend" });

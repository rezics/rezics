import type { KnipConfig } from "knip";

declare const process: { env: Record<string, string | undefined> };

// Mock database URLs used only so knip can load Prisma/runtime env configs.
process.env.DATABASE_URL ??= "postgresql://knip:knip@localhost:5432/knip";
process.env.NOTIFY_DATABASE_URL ??=
  "postgresql://knip:knip@localhost:5432/knip_notify";
process.env.REACTION_DATABASE_URL ??=
  "postgresql://knip:knip@localhost:5432/knip_reaction";
process.env.HISTORY_DATABASE_URL ??=
  "postgresql://knip:knip@localhost:5432/knip_history";
process.env.RANKING_DATABASE_URL ??=
  "postgresql://knip:knip@localhost:5432/knip_ranking";
process.env.JOB_DATABASE_URL ??=
  "postgresql://knip:knip@localhost:5432/knip_job";
process.env.SERVER_DATABASE_URL ??=
  "postgresql://knip:knip@localhost:5432/knip_server";

const config: KnipConfig = {
  ignore: ["prisma", "@tanstack/router-plugin"],
  ignoreWorkspaces: ["@rezics/admin"],
};

export default config;

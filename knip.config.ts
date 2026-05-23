import type { KnipConfig } from "knip";

process.env.DATABASE_URL ??= "postgresql://knip:knip@localhost:5432/knip";
process.env.NOTIFY_DATABASE_URL ??=
  "postgresql://knip:knip@localhost:5432/knip_notify";
process.env.REACTION_DATABASE_URL ??=
  "postgresql://knip:knip@localhost:5432/knip_reaction";
process.env.HISTORY_DATABASE_URL ??=
  "postgresql://knip:knip@localhost:5432/knip_history";

const config: KnipConfig = {
  ignore: ["prisma", "@tanstack/router-plugin"],
  ignoreWorkspaces: ["@rezics/admin"],
};

export default config;

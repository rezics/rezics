import type { KnipConfig } from "knip";

declare const process: { env: Record<string, string | undefined> };

// Mock database URLs used only so knip can load Drizzle/runtime env configs.
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
  ignore: ["@tanstack/router-plugin"],
  ignoreWorkspaces: ["@rezics/admin"],
  // `concurrently` drives the root Taskfile's `storybook` / `build:storybook`
  // fan-out; the toolchain moved from package.json scripts to Taskfiles, which
  // knip cannot see, so mark it used here.
  ignoreDependencies: ["concurrently"],
  workspaces: {
    tool: {
      entry: ["bin/*.ts", "src/commands/**/*.ts", "tests/**/*.test.ts"],
      project: ["**/*.ts"],
    },
    // CLI entry scripts invoked by the Taskfile, not by any package.json
    // script — declare them so knip keeps them and their imports.
    "packages/job-runner": {
      entry: ["src/index.ts", "scripts/ensure-job-db.ts"],
    },
    "packages/utils": {
      entry: ["src/index.ts", "bin/cli.ts"],
    },
  },
};

export default config;

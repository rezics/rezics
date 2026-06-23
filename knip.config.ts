import type { KnipConfig } from "knip";

declare const process: { env: Record<string, string | undefined> };

process.env.DATABASE_URL ??= "postgresql://knip:knip@localhost:5432/knip";

const config: KnipConfig = {
  ignore: [],
  ignoreDependencies: ["concurrently"],
  workspaces: {
    tool: {
      entry: ["bin/*.ts", "src/commands/**/*.ts", "tests/**/*.test.ts"],
      project: ["**/*.ts"],
    },
    "packages/backend": {
      entry: ["src/index.ts"],
    },
    "packages/frontend": {
      entry: ["src/app/**/*.tsx", "src/app/**/*.ts"],
    },
    "packages/core": {
      entry: ["src/index.ts"],
    },
  },
};

export default config;

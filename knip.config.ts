import type {KnipConfig} from 'knip';

const config: KnipConfig = {
  ignore: ['prisma', '@tanstack/router-plugin'],
  ignoreWorkspaces: ['@rezics/admin'],
};

export default config;

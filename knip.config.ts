import type {KnipConfig} from 'knip';

const config: KnipConfig = {
  ignore: ['prisma', '@tanstack/router-plugin'],
  ignoreWorkspaces: ['@package/admin'],
};

export default config;

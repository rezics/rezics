import 'dotenv/config';

const SERVER_PORT = process.env.SERVER_PORT || '3000';

interface EnvConfig {
  SERVER_PORT: string;
}

export const envConfig: EnvConfig = {
  SERVER_PORT: SERVER_PORT,
};

import {SQLDatabase} from 'encore.dev/storage/sqldb';

export const Database = new SQLDatabase('main', {
  migrations: {
    path: './prisma/migrations',
    source: 'prisma',
  },
});

import 'dotenv/config';
import {env} from './env';
import {
  createAuthPrisma,
  createServerPrisma,
  type AuthPrismaClient,
  type ServerPrismaClient,
} from './lib/create-prisma';
import {seedAuthUser} from '../../package/auth/prisma/seed/seed-auth-user';
import type {SeedAuthUserResult} from '../../package/auth/prisma/seed/seed-auth-user';
import {seedServerUser} from './lib/seed-server-user';

export interface CrossSeedUserInput {
  email: string;
  name: string;
  role?: string;
  slug?: string;
  password?: string;
  bio?: string;
  permission?: unknown;
}

export async function crossSeedUser(
  authPrisma: AuthPrismaClient,
  serverPrisma: ServerPrismaClient,
  input: CrossSeedUserInput,
): Promise<SeedAuthUserResult> {
  const authResult = await seedAuthUser(authPrisma, {
    email: input.email,
    name: input.name,
    role: input.role,
    slug: input.slug,
    password: input.password,
  });

  await seedServerUser(serverPrisma, {
    unitId: authResult.userId,
    slug: authResult.slug,
    name: authResult.name,
    bio: input.bio,
    permission: input.permission,
  });

  return authResult;
}

async function main() {
  const authPrisma = createAuthPrisma(env.AUTH_DATABASE_URL);
  const serverPrisma = createServerPrisma(env.SERVER_DATABASE_URL);

  try {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(' Rezics Cross-Service Seed');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const result = await crossSeedUser(authPrisma, serverPrisma, {
      email: 'root@rezics.com',
      name: 'Root User',
      role: 'owner',
      permission: {role: ['ROOT']},
    });

    console.log('');
    console.log(`Email     : ${result.email}`);
    console.log(`Name      : ${result.name}`);
    console.log(`Role      : ${result.role} (auth) / ROOT (server)`);
    console.log(`Slug      : ${result.slug}`);
    console.log(`User ID   : ${result.userId}`);
    console.log('');
    console.log(`Password  : ${result.password}`);
    console.log('');
    console.log('⚠️  Please store this password securely.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
  } finally {
    await Promise.all([authPrisma.$disconnect(), serverPrisma.$disconnect()]);
  }
}

main().catch(err => {
  console.error('[Error] Cross-seed failed:', err);
  process.exitCode = 1;
});

import "dotenv/config";
import type { SeedAuthUserResult } from "../../package/auth/prisma/seed/seed-auth-user";
import { seedAuthUser } from "../../package/auth/prisma/seed/seed-auth-user";
import { env } from "./env";
import {
  type AuthPrismaClient,
  createAuthPrisma,
  createServerPrisma,
  type ServerPrismaClient,
} from "./lib/create-prisma";
import { seedServerUser } from "./lib/seed-server-user";

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

const SEED_USERS: CrossSeedUserInput[] = [
  {
    email: "root@rezics.com",
    name: "Root User",
    role: "owner",
    permission: { role: ["ROOT"] },
  },
  {
    email: "admin@rezics.com",
    name: "Admin User",
    role: "user",
    permission: { role: ["ADMIN"] },
  },
  {
    email: "user@rezics.com",
    name: "Regular User",
    role: "user",
    permission: { role: ["USER"] },
  },
  {
    email: "blocked@rezics.com",
    name: "Blocked User",
    role: "user",
    permission: { role: ["BLOCKED"] },
  },
];

function getServerRole(input: CrossSeedUserInput): string {
  return (input.permission as { role: string[] }).role[0]!;
}

function printUserResult(result: SeedAuthUserResult, serverRole: string) {
  console.log("");
  console.log(`Email     : ${result.email}`);
  console.log(`Name      : ${result.name}`);
  console.log(`Role      : ${result.role} (auth) / ${serverRole} (server)`);
  console.log(`Slug      : ${result.slug}`);
  console.log(`User ID   : ${result.userId}`);
  console.log(`Password  : ${result.password}`);
}

async function deleteExistingUsers(
  authPrisma: AuthPrismaClient,
  serverPrisma: ServerPrismaClient,
) {
  const emails = SEED_USERS.map((u) => u.email);

  const authUsers = await authPrisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });

  if (authUsers.length > 0) {
    const userIds = authUsers.map((u) => u.id);
    await serverPrisma.user.deleteMany({
      where: { unitId: { in: userIds } },
    });
    await authPrisma.userProfile.deleteMany({
      where: { userId: { in: userIds } },
    });
    await authPrisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
    console.log(`🗑️  Deleted ${authUsers.length} existing seed user(s).`);
  }
}

async function seedAll(
  authPrisma: AuthPrismaClient,
  serverPrisma: ServerPrismaClient,
  overwrite: boolean,
) {
  const label = overwrite ? "Overwrite" : "Safe";
  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(` Rezics Cross-Service Seed (${label})`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (overwrite) {
    await deleteExistingUsers(authPrisma, serverPrisma);
  }

  for (const input of SEED_USERS) {
    const result = await crossSeedUser(authPrisma, serverPrisma, input);
    printUserResult(result, getServerRole(input));
  }

  console.log("");
  console.log("⚠️  Please store these passwords securely.");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
}

async function main() {
  const mode = process.argv[2];
  const overwrite = mode === "overwrite";
  const authPrisma = createAuthPrisma(env.AUTH_DATABASE_URL);
  const serverPrisma = createServerPrisma(env.SERVER_DATABASE_URL);

  try {
    await seedAll(authPrisma, serverPrisma, overwrite);
  } finally {
    await Promise.all([authPrisma.$disconnect(), serverPrisma.$disconnect()]);
  }
}

main().catch((err) => {
  console.error("[Error] Cross-seed failed:", err);
  process.exitCode = 1;
});

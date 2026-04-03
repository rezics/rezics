import {hashPassword} from 'better-auth/crypto';
import type {PrismaClient} from '../generated/client';
import {slugify, generatePassword, ensureUniqueSlug} from './helpers';

export interface SeedAuthUserInput {
  email: string;
  name: string;
  role?: string;
  slug?: string;
  password?: string;
}

export interface SeedAuthUserResult {
  userId: string;
  email: string;
  name: string;
  role: string;
  slug: string;
  password: string;
}

export async function seedAuthUser(
  prisma: PrismaClient,
  input: SeedAuthUserInput,
): Promise<SeedAuthUserResult> {
  const role = input.role ?? 'user';
  const password = input.password ?? generatePassword();
  const desiredSlug = input.slug ?? slugify(input.name);
  const slug = await ensureUniqueSlug(prisma, input.email, desiredSlug);
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: {email: input.email},
    update: {
      role,
      emailVerified: true,
    },
    create: {
      name: input.name,
      email: input.email,
      role,
      emailVerified: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  const profile = await prisma.userProfile.upsert({
    where: {userId: user.id},
    update: {slug},
    create: {userId: user.id, slug},
    select: {slug: true},
  });

  await prisma.account.upsert({
    where: {
      providerId_accountId: {
        providerId: 'credential',
        accountId: user.id,
      },
    },
    update: {
      userId: user.id,
      password: passwordHash,
    },
    create: {
      userId: user.id,
      providerId: 'credential',
      accountId: user.id,
      password: passwordHash,
    },
  });

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    slug: profile.slug,
    password,
  };
}

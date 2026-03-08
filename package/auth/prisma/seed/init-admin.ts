import {hashPassword} from 'better-auth/crypto';
import {randomBytes} from 'node:crypto';
import {prisma} from '../client';

const ADMIN_NAME = 'Root User';
const ADMIN_EMAIL = 'root@rezics.com';
const ADMIN_ROLE = 'owner';

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/**
 * 生成 24 位安全随机密码
 */
function generatePassword(): string {
  return randomBytes(18).toString('base64').replace(/[+/=]/g, '').slice(0, 24);
}

async function ensureUniqueSlug(email: string, desiredSlug: string) {
  const existingUser = await prisma.user.findUnique({
    where: {email},
    select: {slug: true},
  });

  if (existingUser?.slug) {
    return existingUser.slug;
  }

  let slug = desiredSlug;
  let suffix = 1;

  while (true) {
    const conflict = await prisma.user.findUnique({
      where: {slug},
      select: {id: true},
    });

    if (!conflict) return slug;

    suffix += 1;
    slug = `${desiredSlug}-${suffix}`;
  }
}

function printSeedResult(info: {
  email: string;
  name: string;
  role: string;
  slug: string;
  password: string;
}) {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' Rezics Auth Seed');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Email     : ${info.email}`);
  console.log(`Name      : ${info.name}`);
  console.log(`Role      : ${info.role}`);
  console.log(`Slug      : ${info.slug}`);
  console.log('');
  console.log(`Password  : ${info.password}`);
  console.log('');
  console.log('⚠️  Please store this password securely.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
}

export async function seedAdmin() {
  const password = generatePassword();
  const slug = await ensureUniqueSlug(ADMIN_EMAIL, slugify(ADMIN_NAME));
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: {email: ADMIN_EMAIL},
    update: {
      name: ADMIN_NAME,
      role: ADMIN_ROLE,
      slug,
      emailVerified: true,
    },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      role: ADMIN_ROLE,
      slug,
      emailVerified: true,
    },
    select: {
      id: true,
      email: true,
      slug: true,
      role: true,
      name: true,
    },
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

  printSeedResult({
    email: user.email,
    name: user.name,
    role: user.role,
    slug: user.slug,
    password,
  });
}

if (require.main === module) {
  try {
    await seedAdmin();
  } finally {
    await prisma.$disconnect();
  }
}

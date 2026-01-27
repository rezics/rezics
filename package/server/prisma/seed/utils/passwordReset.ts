import 'dotenv/config';
import {hashPassword} from '../../../src/user/utils';
import {prisma} from '../../client';

/**
 * Reset all users' passwordHash to the given plaintext password.
 *
 * @param plainPassword - New plaintext password (will be hashed with bcrypt)
 */
export async function resetAllUserPasswords(
  plainPassword = '123456',
): Promise<void> {
  const passwordHash = await hashPassword(plainPassword);

  console.log('Resetting all user passwords...');

  const result = await prisma.user.updateMany({
    data: {
      passwordHash,
    },
  });

  console.log(
    `Password reset complete. Updated ${result.count} user(s) to the new password.`,
  );
}

export async function resetUserPassword(
  email: string,
  newPassword: string,
): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: {email},
    data: {passwordHash},
  });
}

async function main() {
  // Optional first CLI argument: new password
  const plainPassword = process.argv[2] ?? '123456';

  await resetAllUserPasswords(plainPassword);
}

main()
  .catch(err => {
    console.error('Failed to reset user passwords:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

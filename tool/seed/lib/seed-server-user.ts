import type { ServerPrismaClient } from "./create-prisma";

export interface SeedServerUserInput {
  unitId: string;
  slug: string;
  name: string;
  avatar?: string;
  bio?: string;
  permission?: any;
}

export async function seedServerUser(
  prisma: ServerPrismaClient,
  input: SeedServerUserInput,
): Promise<void> {
  await prisma.user.upsert({
    where: { unitId: input.unitId },
    update: {},
    create: {
      unitId: input.unitId,
      slug: input.slug,
      name: input.name,
      avatar: input.avatar,
      bio: input.bio,
      permission: input.permission,
      joinDate: new Date(),
    },
  });
}

import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import type { PrismaClient } from "#/prisma/generated/client.js";
import type { CreatedUser } from "./types.js";
import { createUsernameGenerator, generateParagraph } from "./utils.js";

function generateSlug(name: string): string {
  return `${name.replace(/\s+/g, "_")}_${randomUUID()}`;
}

/**
 * Seed users via createMany. Admin is created first, then bulk insert.
 */
export async function seedUsers(
  prisma: PrismaClient,
  total: number,
): Promise<CreatedUser[]> {
  console.log(`[Seed] Seeding ${total} users...`);
  const nextUsername = createUsernameGenerator();

  // Admin user (separate — has permission JSON)
  const adminId = randomUUID();
  await prisma.user.create({
    data: {
      unitId: adminId,
      slug: "admin",
      name: "Admin",
      avatar: faker.image.avatar(),
      bio: generateParagraph(1, 2),
      description: generateParagraph(5, 10),
      joinDate: faker.date.past({ years: 4 }),
      permission: { role: ["ADMIN"] },
    },
  });

  // Bulk create regular users
  const userData = Array.from({ length: total }, () => {
    const name = nextUsername();
    return {
      unitId: randomUUID(),
      slug: generateSlug(name),
      name,
      avatar: faker.image.avatar(),
      bio: generateParagraph(1, 2),
      description: generateParagraph(5, 10),
      joinDate: faker.date.past({ years: 4 }),
    };
  });

  await prisma.user.createMany({ data: userData });

  return userData.map((u) => ({ unitId: u.unitId, name: u.name, slug: u.slug }));
}

import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import type { PrismaClient } from "#/prisma/generated/client.js";
import type { CreatedOrganization, CreatedPerson } from "./types.js";

/**
 * Seed Person records via createMany.
 */
export async function seedPeople(
  prisma: PrismaClient,
  total: number,
): Promise<CreatedPerson[]> {
  console.log(`[Seed] Seeding ${total} people...`);

  const data = Array.from({ length: total }, () => ({
    id: randomUUID(),
    name: faker.person.fullName(),
    extra: {
      nationality: faker.location.country(),
      birthYear: faker.date.past({ years: 80 }).getFullYear(),
    },
  }));

  await prisma.person.createMany({ data });

  return data.map((p) => ({ id: p.id, name: p.name }));
}

/**
 * Seed Organization records via createMany.
 */
export async function seedOrganizations(
  prisma: PrismaClient,
  total: number,
): Promise<CreatedOrganization[]> {
  console.log(`[Seed] Seeding ${total} organizations...`);

  const data = Array.from({ length: total }, () => ({
    id: randomUUID(),
    name: faker.company.name(),
    extra: {
      country: faker.location.country(),
      foundedYear: faker.date.past({ years: 50 }).getFullYear(),
    },
  }));

  await prisma.organization.createMany({ data });

  return data.map((o) => ({ id: o.id, name: o.name }));
}
